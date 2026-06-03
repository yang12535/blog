$data = Get-Content 'pr5-comments.json' -Raw | ConvertFrom-Json
foreach ($c in $data) {
    Write-Output "FILE: $($c.path)"
    Write-Output "BODY: $($c.body)"
    Write-Output "---"
}
