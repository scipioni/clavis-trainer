import type { Page } from 'playwright-core';

/**
 * La guida al posizionamento delle dita si apre da sola al primo avvio e alla
 * prima volta su un tipo di tastiera: nei test che non la riguardano la si
 * chiude con Esc appena copre la pagina (prima di ogni azione di Playwright).
 */
export async function dismissGuide(page: Page) {
  await page.addLocatorHandler(page.getByTestId('guide'), async () => {
    await page.keyboard.press('Escape');
    await page.getByTestId('guide').waitFor({ state: 'detached' });
  });
}
