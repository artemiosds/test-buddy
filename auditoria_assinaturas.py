import asyncio
import os
import json
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        
        # Restaurar sessão se disponível
        storage_key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
        session_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
        
        page = await context.new_page()
        await page.goto("http://localhost:8080")
        
        if storage_key and session_json:
            await page.evaluate(f"window.localStorage.setItem({json.dumps(storage_key)}, {json.dumps(session_json)})")
            await page.goto("http://localhost:8080/assinaturas") # Assumindo rota de gestão
        
        # Capturar evidência da tela de gestão de assinaturas
        await page.wait_for_timeout(2000)
        await page.screenshot(path="/tmp/browser/auditoria_assinaturas.png")
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
