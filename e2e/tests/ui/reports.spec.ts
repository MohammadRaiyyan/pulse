import { expect, goTo, tableRow, test } from "../../support/fixtures.ts";

const isoDaysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

test.describe("reports", () => {
  test("shows the summary, charts and monitors and switches ranges", async ({ pageAs }) => {
    const page = await pageAs("viewer");
    await goTo(page, "Reports");
    const main = page.locator("main");

    await expect(page.getByRole("heading", { name: "Reports", level: 1 })).toBeVisible();
    await expect(page.getByRole("tab", { name: "30 days" })).toHaveAttribute("data-state", "active");
    await expect(main.getByText("Mean time to acknowledge")).toBeVisible();
    await expect(main.getByText("Estimated from critical monitor incidents")).toBeVisible();
    await expect(main.getByRole("heading", { name: "Daily uptime" })).toBeVisible();
    await expect(main.getByRole("heading", { name: "Daily response time" })).toBeVisible();
    await expect(tableRow(page, "Public API").first()).toBeVisible();

    await page.getByRole("tab", { name: "7 days" }).click();
    await expect(page).toHaveURL(/range=7d/);
    await expect(main.getByText(/\(UTC\), 7 days\./).first()).toBeVisible();

    await page.getByRole("tab", { name: "Custom" }).click();
    await expect(page).toHaveURL(/range=custom/);
    await page.getByLabel("From (UTC)").fill(isoDaysAgo(60));
    await page.getByLabel("To (UTC)").fill(isoDaysAgo(2));
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page).toHaveURL(new RegExp(`from=${isoDaysAgo(60)}.*to=${isoDaysAgo(2)}`));
    await expect(main.getByText(/\(UTC\), 59 days\./).first()).toBeVisible();

    await page.getByLabel("To (UTC)").fill(isoDaysAgo(70));
    await expect(page.getByRole("alert")).toContainText("The end date must be on or after the start date");
    await expect(page.getByRole("button", { name: "Apply" })).toBeDisabled();
  });

  test("sorts monitors and colors uptime against the SLA target", async ({ pageAs }) => {
    const page = await pageAs("owner");
    await page.goto("/reports?range=90d&slaTarget=50");

    await expect(tableRow(page, "Public API").getByText("Met", { exact: true })).toBeVisible();

    await page.getByLabel("SLA target (%)").fill("100");
    await page.getByLabel("SLA target (%)").press("Enter");
    await expect(page).toHaveURL(/slaTarget=100/);
    await expect(tableRow(page, "Public API").getByText("Breached", { exact: true })).toBeVisible();

    const monitorNames = () => page.locator("main table").first().locator("tbody tr td:first-child").allTextContents();

    const ascending = (await monitorNames()).toSorted((left, right) => left.localeCompare(right));
    expect(ascending.length).toBeGreaterThan(1);

    await page.getByRole("button", { name: /Sort by Monitor/ }).click();
    await expect.poll(monitorNames).toEqual(ascending);

    await page.getByRole("button", { name: /Sort by Monitor/ }).click();
    await expect.poll(monitorNames).toEqual(ascending.toReversed());
  });

  test("exports the report as a CSV download", async ({ pageAs }) => {
    const page = await pageAs("owner");
    await page.goto("/reports?range=7d");
    await expect(tableRow(page, "Public API").first()).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV" }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe(`pulse-report-${isoDaysAgo(6)}-${isoDaysAgo(0)}.csv`);
  });

  test("a monitor page links to its own report", async ({ pageAs }) => {
    const page = await pageAs("owner");
    await goTo(page, "Monitors");
    await tableRow(page, "Public API").getByRole("link", { name: "Public API" }).click();
    await page.getByRole("link", { name: "Report", exact: true }).click();

    await expect(page).toHaveURL(/\/reports\?.*monitorId=/);
    await expect(page.getByText("Showing", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Services" })).toHaveCount(0);

    await page.getByRole("link", { name: "All monitors" }).click();
    await expect(page).not.toHaveURL(/monitorId=/);
  });
});
