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

test("real V1 journey reaches publish, media, analytics and QR", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "Run the database journey once; responsive behavior has separate coverage.",
  );
  test.setTimeout(60_000);

  const unique = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const username = `e2e_${unique}`.slice(0, 30);

  await page.goto("/register");
  await page.getByLabel("Email address").fill(`${username}@example.com`);
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Choose a password").fill("Strong-password-123!");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/onboarding$/);

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
  await expect(
    page.getByRole("link", { name: /E2E destination/ }),
  ).toBeVisible();
  await expect(page.getByAltText("One pixel test image")).toBeVisible();
  await expect(page.getByRole("link", { name: "GITHUB" })).toBeVisible();
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

  expect(link.id).toBeTruthy();
});
