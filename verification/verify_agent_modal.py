import sqlite3
import os
from playwright.sync_api import sync_playwright

def verify_agent_modal():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Go to a package settings page
        url = "http://localhost:3000/?view=repo&package=%40test%2Ffix-package"
        print(f"Navigating to {url}")
        page.goto(url)
        page.wait_for_selector("text=@test/fix-package")

        # Navigate to Settings
        print("Clicking Settings tab...")
        page.click("button:has-text('Settings')")
        page.wait_for_selector("text=General Settings")

        # Click Save
        print("Clicking Save Changes...")
        save_btn = page.locator("button:has-text('Save Changes')")
        save_btn.click()

        # Verify Agent Action Modal
        print("Verifying Agent Action Modal...")
        try:
            page.wait_for_selector("text=Agent Action Required", timeout=5000)
            page.wait_for_selector("text=botkit repo update")
            print("Modal appeared with correct command.")
            page.screenshot(path="verification/agent_modal.png")
        except:
            print("ERROR: Agent Action Modal did not appear.")
            page.screenshot(path="verification/agent_modal_fail.png")
            raise

        # Test the Debug Bypass
        print("Testing Debug Bypass...")
        page.click("text=[Debug] Execute as Local Admin")

        # Check for success checkmark on the original button
        page.wait_for_selector("text=✓", timeout=5000)
        print("Debug execution successful.")

        browser.close()

if __name__ == "__main__":
    verify_agent_modal()
