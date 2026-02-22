from playwright.sync_api import sync_playwright
import time

def verify_agent_modal():
    with sync_playwright() as p:
        # Launch browser
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        page.on("console", lambda msg: print(f"Browser Console: {msg.text}"))

        try:
            # Navigate to the package page (New URL Structure)
            print("Navigating to http://localhost:3000/@test/fix-package")
            page.goto("http://localhost:3000/@test/fix-package")

            # Wait for page load
            time.sleep(3)

            # Check if loading
            if page.is_visible("text=Loading repository..."):
                print("Still loading...")
                time.sleep(5)

            print("Clicking Settings tab...")
            # Click "Settings" link
            page.click("a:has-text('Settings')")
            time.sleep(2)

            print("Interacting with Settings form...")
            page.wait_for_selector("input[type='checkbox']")
            page.click("input[type='checkbox']:nth-of-type(1)")

            print("Clicking Save Changes...")
            page.click("button:has-text('Save Changes')")

            # Wait for modal
            print("Waiting for Agent Action Modal...")
            page.wait_for_selector("text=Agent Action Required")

            # Verify CLI command
            content = page.content()
            if "botkit repo update" in content:
                print("✅ Modal appeared with correct CLI command")
            else:
                print("❌ Modal content missing CLI command")
                exit(1)

            # Test Debug Execute
            print("Testing Debug Execute...")
            page.click("text=[Debug] Execute as Local Admin")

            # Wait for modal to close
            time.sleep(2)

            # Verify screenshot
            page.screenshot(path="verification/agent_modal_v2.png")
            print("✅ Screenshot saved to verification/agent_modal_v2.png")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
            raise e

        browser.close()

if __name__ == "__main__":
    verify_agent_modal()
