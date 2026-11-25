// Keep the specific module pattern first. TypeScript chooses the first
// matching wildcard declaration with the longest prefix; both patterns
// have an empty prefix, so declaration order decides.
declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}

declare module '*.css';
