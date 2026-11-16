/** Tutti i pesi dell'analisi in un posto solo, da tarare con l'uso reale. */

/** Fattore della media mobile esponenziale: più alto = più peso ai campioni recenti. */
export const EMA_ALPHA = 0.1;
/** Campioni minimi perché un'unità entri nelle classifiche. */
export const MIN_SAMPLES = 5;
/** Tempi oltre questa soglia sono esitazioni e non entrano nella media. */
export const MAX_SAMPLE_MS = 2000;
/** Peso del tasso di errore nel punteggio: score ∝ (1 + ERROR_WEIGHT · errori). */
export const ERROR_WEIGHT = 10;
/** Peso del tasso di attivazioni involontarie dei mod. */
export const MISFIRE_WEIGHT = 5;
