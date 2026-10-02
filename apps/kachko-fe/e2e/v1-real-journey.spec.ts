import { expect, test, type Page } from "@playwright/test";

type JsonObject = Record<string, unknown>;

async function api<T>(
  page: Page,
  path: string,
  method = "GET",
  body?: JsonObject,
): Promise<T> {
  return page.evaluate(
    async ({ path, method, body }) => {
      const response = await fetch(`/api/v1${path}`, {
        method,
        credentials: "include",
        headers:
          method === "GET"
            ? undefined
            : { "Content-Type": "application/json", "X-Kachko-CSRF": "1" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(`${response.status} ${JSON.stringify(payload)}`);
      return payload.data;
    },
    { path, method, body },
  ) as Promise<T>;
}

test("real V1 and V1.1 journey reaches leads, publish, media, analytics and QR", async ({
  page,
  browser,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "Run the database journey once; responsive behavior has separate coverage.",
  );
  test.setTimeout(90_000);

  const unique = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const username = `e2e_${unique}`.slice(0, 30);

  await page.goto("/register");
  await page.getByLabel("Email address").fill(`${username}@example.com`);
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Choose a password").fill("Strong-password-123!");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/onboarding$/, { timeout: 20_000 });

  const created = await api<{ id: string }>(page, "/pages", "POST", {
    title: "V1 journey",
  });
  const link = await api<{ id: string }>(
    page,
    `/pages/${created.id}/blocks`,
    "POST",
    {
      type: "LINK",
      content: {
        title: "E2E destination",
        url: "https://example.com/",
        openInNewTab: true,
      },
    },
  );

  const media = await page.evaluate(async () => {
    const encoded =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    const bytes = Uint8Array.from(atob(encoded), (character) =>
      character.charCodeAt(0),
    );
    const authorize = await fetch("/api/v1/media/upload-url", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", "X-Kachko-CSRF": "1" },
      body: JSON.stringify({
        mimeType: "image/png",
        size: bytes.length,
        forAvatar: false,
      }),
    });
    const targetPayload = await authorize.json();
    if (!authorize.ok) throw new Error(JSON.stringify(targetPayload));
    const target = targetPayload.data;
    const uploaded = await fetch(target.uploadUrl, {
      method: target.method,
      credentials: "include",
      headers: target.headers,
      body: bytes,
    });
    if (!uploaded.ok) throw new Error(`Upload failed: ${uploaded.status}`);
    const completed = await fetch("/api/v1/media/complete", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", "X-Kachko-CSRF": "1" },
      body: JSON.stringify({
        storageKey: target.storageKey,
        width: 1,
        height: 1,
        forAvatar: false,
      }),
    });
    const completedPayload = await completed.json();
    if (!completed.ok) throw new Error(JSON.stringify(completedPayload));
    return completedPayload.data as { id: string };
  });

  await api(page, `/pages/${created.id}/blocks`, "POST", {
    type: "IMAGE",
    content: { mediaId: media.id, alt: "One pixel test image" },
  });
  await api(page, `/pages/${created.id}/appearance`, "PATCH", {
    themeKey: "dark",
  });
  await api(page, `/pages/${created.id}/socials`, "POST", {
    platform: "GITHUB",
    username,
    url: `https://github.com/${username}`,
    isVisible: true,
  });
  const contactForm = await api<{ id: string }>(page, `/pages/${created.id}/forms`, "POST", { name: "Contact", title: "Contact us", submitLabel: "Send enquiry", successConfig: { message: "Enquiry received" } });
  for (const field of [
    { type: "TEXT", label: "Name", name: "name", required: true },
    { type: "EMAIL", label: "Contact email", name: "email", required: true },
    { type: "TEXTAREA", label: "Message", name: "message", required: true },
  ]) await api(page, `/forms/${contactForm.id}/fields`, "POST", field);
  await api(page, `/pages/${created.id}/blocks`, "POST", { type: "FORM", content: { formId: contactForm.id, variant: "CARD" } });
  const subscribeForm = await api<{ id: string }>(page, `/pages/${created.id}/forms`, "POST", { name: "Newsletter", title: "Join updates", submitLabel: "Subscribe" });
  await api(page, `/forms/${subscribeForm.id}/fields`, "POST", { type: "EMAIL", label: "Subscriber email", name: "email", required: true });
  await api(page, `/forms/${subscribeForm.id}/fields`, "POST", { type: "CHECKBOX", label: "I agree to receive updates", name: "marketing_consent", required: true });
  await api(page, `/pages/${created.id}/blocks`, "POST", { type: "SUBSCRIBE", content: { formId: subscribeForm.id, title: "Join updates" } });
  await api(page, `/pages/${created.id}/blocks`, "POST", { type: "WHATSAPP", content: { label: "Chat with us", phoneNumber: "+919999999999", messageTemplate: "Hello from Kachko" } });
  await api(page, `/pages/${created.id}/publish`, "POST", {});

  const qr = await page.evaluate(async (pageId) => {
    const response = await fetch(`/api/v1/pages/${pageId}/qr`, {
      credentials: "include",
    });
    return {
      ok: response.ok,
      type: response.headers.get("content-type"),
      url: response.headers.get("x-kachko-qr-url"),
      size: (await response.arrayBuffer()).byteLength,
    };
  }, created.id);
  expect(qr).toMatchObject({ ok: true, type: "image/png" });
  expect(qr.url).toContain(`/${username}`);
  expect(qr.size).toBeGreaterThan(100);

  await page.goto(`/${username}`);
  await page.setViewportSize({ width: 1440, height: 900 });
  const desktopShell = await page.locator("[data-public-profile-shell]").boundingBox();
  expect(desktopShell?.width).toBeLessThanOrEqual(681);
  expect(desktopShell?.x).toBeGreaterThan(300);
  await expect(page.locator("[data-desktop-qr]")).toBeVisible();
  await expect(page.getByRole("button", { name: "Share this page" })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileShell = await page.locator("[data-public-profile-shell]").boundingBox();
  expect(mobileShell?.width).toBe(390);
  expect(mobileShell?.x).toBe(0);
  await expect(page.locator("[data-desktop-qr]")).toBeHidden();
  await expect(page.getByRole("button", { name: "Share this page" })).toBeHidden();
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(
    page.getByRole("link", { name: /E2E destination/ }),
  ).toBeVisible();
  await expect(page.getByAltText("One pixel test image")).toBeVisible();
  await expect(page.getByRole("link", { name: "GITHUB" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Chat with us" })).toHaveAttribute("href", /wa\.me\/919999999999/);
  const contact = page.locator("form").filter({ hasText: "Contact us" });
  await contact.getByLabel("Name").fill("Lead One");
  await contact.getByLabel("Contact email").fill("lead@example.com");
  await contact.getByLabel("Message").fill("Need a website");
  await contact.getByRole("button", { name: "Send enquiry" }).click();
  await expect(page.getByText("Enquiry received")).toBeVisible();
  const repeated = await page.evaluate(async (formId) => {
    const response = await fetch(`/api/v1/public/forms/${formId}/submissions`, {
      method: "POST", headers: { "Content-Type": "application/json", "X-Kachko-CSRF": "1" },
      body: JSON.stringify({ values: { name: "Lead One", email: "LEAD@example.com", message: "Following up" }, marketingOptIn: false }),
    });
    return { ok: response.ok, status: response.status };
  }, contactForm.id);
  expect(repeated).toEqual({ ok: true, status: 201 });
  const subscribe = page.locator("form").filter({ hasText: "Join updates" });
  await subscribe.getByLabel("Subscriber email").fill("subscriber@example.com");
  await subscribe.getByRole("checkbox").check();
  await subscribe.getByRole("button", { name: "Subscribe" }).click();
  await expect(page.getByText(/Thanks — your response was received/i)).toBeVisible();
  await page.evaluate(() =>
    document
      .querySelector('[data-event="LINK_CLICK"]')
      ?.addEventListener("click", (event) => event.preventDefault(), {
        once: true,
      }),
  );
  await page.getByRole("link", { name: /E2E destination/ }).click();

  await expect
    .poll(
      async () => {
        const summary = await api<{ totalViews: number; linkClicks: number }>(
          page,
          `/pages/${created.id}/analytics/summary?range=today`,
        );
        return { views: summary.totalViews, clicks: summary.linkClicks };
      },
      { timeout: 10_000 },
    )
    .toEqual({ views: 1, clicks: 1 });

  await page.goto("/dashboard/audience");
  await expect(page.getByText("lead@example.com")).toBeVisible();
  await expect(page.getByText("subscriber@example.com")).toBeVisible();
  const audience = await api<{ items: { id: string; email: string | null; marketingOptIn: boolean }[]; total: number }>(page, "/audience/contacts");
  expect(audience.total).toBe(2);
  const leadId = audience.items.find(item => item.email === "lead@example.com")?.id;
  expect(leadId).toBeTruthy();
  expect(audience.items.find(item => item.email === "subscriber@example.com")?.marketingOptIn).toBe(true);
  await api(page, `/audience/contacts/${leadId}/tags`, "POST", { name: "Warm lead" });
  const tagged = await api<{ items: { id: string }[]; total: number }>(page, "/audience/contacts?tag=warm%20lead");
  expect(tagged).toMatchObject({ total: 1, items: [{ id: leadId }] });
  const csv = await page.evaluate(async () => (await fetch("/api/v1/audience/export", { credentials: "include" })).text());
  expect(csv).toContain("lead@example.com");
  expect(csv).toContain("subscriber@example.com");
  await expect.poll(async () => (await api<{ leads: number }>(page, `/analytics/pages/${created.id}/conversion-funnel`)).leads).toBe(2);

  const outsider = await browser.newContext();
  const outsiderPage = await outsider.newPage();
  const outsiderName = `other_${unique}`.slice(0, 30);
  await outsiderPage.goto("/register");
  await outsiderPage.getByLabel("Email address").fill(`${outsiderName}@example.com`);
  await outsiderPage.getByLabel("Username").fill(outsiderName);
  await outsiderPage.getByLabel("Choose a password").fill("Strong-password-123!");
  await outsiderPage.getByRole("checkbox").check();
  await outsiderPage.getByRole("button", { name: "Continue" }).click();
  await expect(outsiderPage).toHaveURL(/\/onboarding$/, { timeout: 20_000 });
  const foreignRead = await outsiderPage.evaluate(async (id) => {
    const response = await fetch(`/api/v1/audience/contacts/${id}`, { credentials: "include" });
    return response.status;
  }, leadId!);
  expect(foreignRead).toBe(404);
  await outsider.close();

  expect(link.id).toBeTruthy();
});
