param([switch]$Live)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$work = Join-Path $root ".cache/windows-download-tests-$([Guid]::NewGuid().ToString('N'))"
New-Item -ItemType Directory -Path $work -Force | Out-Null
$script:calls = [Collections.Generic.List[string]]::new()
$script:responses = @{}
$script:liveRequests = $false

function Assert($Condition, [string]$Message) {
    if (-not $Condition) { throw "FAIL: $Message" }
    Write-Host "PASS: $Message"
}

function Write-Info($Message) { Write-Host $Message }

function Invoke-WebRequest {
    [CmdletBinding()]
    param([string]$Uri, [string]$OutFile, [switch]$UseBasicParsing, [int]$TimeoutSec)
    $script:calls.Add($Uri)
    if ([IO.Path]::DirectorySeparatorChar -eq '/') {
        $OutFile = $OutFile.Replace('\', '/')
        $PSBoundParameters['OutFile'] = $OutFile
    }
    if ($script:liveRequests) {
        Microsoft.PowerShell.Utility\Invoke-WebRequest @PSBoundParameters
        return
    }
    if (-not $script:responses.ContainsKey($Uri)) { throw '模拟下载失败' }
    [IO.File]::WriteAllText($OutFile, $script:responses[$Uri], [Text.UTF8Encoding]::new($false))
}

try {
    $first = $null
    $scripts = @{}
    foreach ($post in @('win-restore-workflow', 'win-terminal-setup')) {
        $markdown = [IO.File]::ReadAllText((Join-Path $root "content/posts/$post.md"))
        $code = [regex]::Match($markdown, '(?s)```powershell\r?\n(.*?)\r?\n```').Groups[1].Value
        $tokens = $null
        $errors = $null
        $ast = [Management.Automation.Language.Parser]::ParseInput($code, [ref]$tokens, [ref]$errors)
        Assert ($code.Length -gt 0 -and $errors.Count -eq 0) "$post 主脚本语法"
        Assert ($code -notmatch 'api\.github\.com|LatestRelease|api/scoring|github-release/') "$post 不再查询 latest 或教育网 GitHub 镜像"
        $functions = @($ast.FindAll({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Get-WithProxy' }, $false))
        Assert ($functions.Count -eq 1) "$post 使用旧版 Get-WithProxy"
        $definition = $functions[0].Extent.Text
        if ($null -ne $first) { Assert ($definition -ceq $first) '两篇文章代理函数一致' }
        $first = $definition
        $scripts[$post] = $code
    }
    . ([scriptblock]::Create($first))
    $output = Join-Path $work 'fixture.exe'
    [IO.File]::WriteAllText($output, 'verified payload', [Text.UTF8Encoding]::new($false))
    $hash = (Get-FileHash $output).Hash
    $url = 'https://github.com/example/tool/releases/download/v1.0.0/tool.exe'
    $v4 = "https://v4.gh-proxy.org/$url"
    $main = "https://gh-proxy.org/$url"
    $fast = "https://ghfast.top/$url"
    $script:responses[$v4] = 'wrong payload'
    $script:responses[$main] = 'verified payload'
    $oldProgress = $ProgressPreference
    Get-WithProxy -Url $url -OutFile $output -Sha256 $hash
    Assert (($script:calls -join '|') -eq "$v4|$main" -and (Get-FileHash $output).Hash -eq $hash) 'v4 哈希不符后切换主站，逐源校验'
    Assert ($ProgressPreference -eq $oldProgress) '成功后恢复进度设置'
    $script:responses.Clear()
    $script:responses[$url] = 'verified payload'
    $script:calls.Clear()
    Get-WithProxy -Url $url -OutFile $output -Sha256 $hash
    Assert (($script:calls -join '|') -eq "$v4|$main|$fast|$url") '三个代理失败后才尝试 GitHub 直连'
    $script:responses[$url] = 'bad'
    $failed = $false
    try { Get-WithProxy -Url $url -OutFile $output -Sha256 $hash } catch { $failed = $true }
    Assert ($failed -and -not (Test-Path $output)) '所有来源失败时停止并删除错误包'
    Assert ($ProgressPreference -eq $oldProgress) '失败后恢复进度设置'

    if ($Live) {
        $script:liveRequests = $true
        $script:calls.Clear()
        $temp = $work
        $code = $scripts['win-restore-workflow']
        foreach ($variable in @('ps7', 'git')) {
            $pattern = '(?ms)^    \$' + $variable + 'Ver =.*?^    Get-WithProxy[^\r\n]*'
            $snippet = [regex]::Match($code, $pattern).Value
            Assert ($snippet.Length -gt 0) "$variable 使用文章原始下载段"
            . ([scriptblock]::Create($snippet))
            Assert (Test-Path (Get-Variable -Name "${variable}Out" -ValueOnly)) "$variable 代理完整下载和 SHA256 通过"
        }
        $snippet = [regex]::Match($scripts['win-terminal-setup'], '(?ms)^\$wtVer =.*?(?=^\$wtDest =)').Value
        Assert ($snippet.Length -gt 0) 'Windows Terminal 使用文章原始下载段'
        . ([scriptblock]::Create($snippet))
        Assert ((Get-FileHash $wtZip).Hash -eq $wtHash) 'Windows Terminal 代理完整下载和 SHA256 通过'
        $snippet = [regex]::Match($code, '(?ms)^    \$nodeVer =.*?(?=^    \$proc =)').Value
        Assert ($snippet.Length -gt 0) 'Node.js 使用历史文章的 TUNA 下载段'
        . ([scriptblock]::Create($snippet))
        Assert ((Get-FileHash $nodeOut).Hash -eq $nodeHash) 'Node.js TUNA 完整下载和 SHA256 通过'
        Assert (@($script:calls | Where-Object { $_ -match 'api\.github\.com|LatestRelease|api/scoring|github-release/' }).Count -eq 0) '真实请求没有动态元数据或 GitHub 镜像'
    }
    Write-Host 'ALL WINDOWS DOWNLOAD TESTS PASSED'
} finally {
    Remove-Item $work -Recurse -Force
}
