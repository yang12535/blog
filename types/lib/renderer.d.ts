export interface RenderContext {
  site?: Record<string, any>;
  [key: string]: any;
}

export type RenderFunction = (tpl: string, ctx: RenderContext, rootPath?: string) => string;

/**
 * Creates a Nunjucks renderer configured for the blog templates.
 * @param templateDir Directory containing Nunjucks templates
 * @returns A render function that accepts template name, context, and optional root path
 */
export function createRenderer(templateDir: string): RenderFunction;
