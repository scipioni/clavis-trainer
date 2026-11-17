/**
 * Azione Svelte: mette il focus sul pulsante appena compare (o appena si
 * abilita), così si continua da tastiera senza mouse.
 *
 * Per un breve intervallo il pulsante ignora Invio e Spazio: chi stava
 * scrivendo quando la sessione è finita (per esempio allo scadere del tempo)
 * non deve avviarne un'altra per sbaglio con il tasto successivo.
 */
export function focusOnShow(node: HTMLButtonElement, guardMs = 800) {
  const shownAt = performance.now();
  let focused = false;

  const tryFocus = () => {
    if (focused || node.disabled) return;
    focused = true;
    node.focus({ preventScroll: true });
  };

  const guard = (e: KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && performance.now() - shownAt < guardMs) e.preventDefault();
  };

  tryFocus();
  // il pulsante può nascere disabilitato (corpus ancora in caricamento)
  const observer = new MutationObserver(tryFocus);
  observer.observe(node, { attributes: true, attributeFilter: ['disabled'] });
  node.addEventListener('keydown', guard);
  node.addEventListener('keyup', guard);

  return {
    destroy() {
      observer.disconnect();
      node.removeEventListener('keydown', guard);
      node.removeEventListener('keyup', guard);
    },
  };
}
