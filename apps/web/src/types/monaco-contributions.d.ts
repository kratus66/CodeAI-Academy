/**
 * `monaco-editor` no publica tipos para el registro de tokenizadores básicos:
 * el módulo sólo registra lenguajes al importarse y no exporta nada, así que la
 * declaración se limita a declarar su existencia (S5-T12).
 */
declare module "monaco-editor/esm/vs/basic-languages/monaco.contribution";
