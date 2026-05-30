import { test, expect } from "@playwright/test";

// Uses a seeded test location's QR token.
// Set PLAYWRIGHT_QR_TOKEN in the test environment to a valid token from the seed.
const QR_TOKEN = process.env.PLAYWRIGHT_QR_TOKEN ?? "test-token-replace-with-seeded-value";

test.describe("QR ticket submission (happy path)", () => {
  test("staff can submit a ticket and receive a reference code", async ({ page }) => {
    await page.goto(`/submit/${QR_TOKEN}`);

    // Location name is shown
    await expect(page.getByText(/Location/)).toBeVisible();

    // Select IT category
    await page.getByRole("radio", { name: /IT/i }).check();

    // Fill in description
    await page.getByLabel(/Description/i).fill(
      "The POS terminal at station 2 is not turning on. This has been happening since opening.",
    );

    // Attach a small test image
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "test-photo.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.alloc(1024, 0xff),
    });

    // Submit
    await page.getByRole("button", { name: /submit ticket/i }).click();

    // Confirmation screen with reference code
    await expect(page.getByText(/Ticket submitted/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/reference code/i)).toBeVisible();
  });
});

test.describe("QR ticket submission (invalid token)", () => {
  test("shows error for unknown token", async ({ page }) => {
    await page.goto("/submit/definitely-not-a-real-token-12345");
    await expect(page.getByText(/no longer active|not found/i)).toBeVisible();
  });
});
