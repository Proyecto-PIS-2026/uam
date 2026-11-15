import baseConfig from "./playwright.config";

// Configuracion local auxiliar: usa Microsoft Edge sin editar playwright.config.ts.
// No incluir este archivo en el PR; solamente se versionan los dos tests modificados.
export default {
  ...baseConfig,
  projects: baseConfig.projects?.map((project) => ({
    ...project,
    use: {
      ...project.use,
      channel: "msedge" as const,
    },
  })),
};
