import { type PlopTypes } from "@turbo/gen";
export default function generator(plop: PlopTypes.NodePlopAPI) {
  plop.setGenerator("Generate package", {
    description: "Generate package skeleton",
    prompts: [
      {
        type: "input",
        name: "name",
        message: "What is your package name?",
      },
    ],
    actions: [
      {
        type: "add",
        path: "packages/{{name}}/src/index.ts",
      },
      {
        type: "add",
        path: "packages/{{name}}/package.json",
        templateFile: "templates/package.hbs",
      },
      {
        type: "add",
        path: "packages/{{name}}/tsconfig.json",
        templateFile: "templates/tsconfig.hbs",
      },
      {
        type: "add",
        path: "packages/{{name}}/eslint.config.js",
        templateFile: "templates/eslint.hbs",
      },
    ],
  });
}
