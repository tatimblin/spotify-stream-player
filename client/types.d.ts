declare module "*.module.scss" {
  const content: Record<string, string>;
  export default content;
  export const code: string;
}

declare module '*.scss' {
  const content: string;
  export default content;
}