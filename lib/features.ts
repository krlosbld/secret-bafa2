// Interrupteurs de fonctionnalités. La refonte du suivi pédagogique (3 appréciations par session,
// nouvelle lecture de l'évolution, nouveaux écrans) s'installe par étapes mais ne s'active qu'en une
// fois, quand tout le parcours est prêt : EVALUATION_V2=1 dans le .env du serveur.
export function evaluationV2Enabled(): boolean {
  return process.env.EVALUATION_V2 === "1";
}
