import { assertEquals, assertNotEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  categorizeSanMarImages,
  sanmarCdnUrlToProxyUrl,
  convertAllSanMarUrlsToProxy,
  buildSanMarCdnFallbackUrl,
  buildSanMarProxyUrl,
  type MockupImageResult,
} from "./image-cache.ts";

const sampleImages = [
  { url: "https://cdn.sanmar.com/PC54_JetBlack_fm.jpg", productId: "PC54", partId: "PC54-JetBlack-S", classTypeName: "Front Model", color: "Jet Black", singlePart: false },
  { url: "https://cdn.sanmar.com/PC54_JetBlack_bk.jpg", productId: "PC54", partId: "PC54-JetBlack-S", classTypeName: "Back Model", color: "Jet Black", singlePart: false },
  { url: "https://cdn.sanmar.com/PC54_JetBlack_sd.jpg", productId: "PC54", partId: "PC54-JetBlack-S", classTypeName: "Side", color: "Jet Black", singlePart: false },
  { url: "https://cdn.sanmar.com/PC54_JetBlack_sw.jpg", productId: "PC54", partId: "PC54-JetBlack-S", classTypeName: "Swatch", color: "Jet Black", singlePart: false },
  { url: "https://cdn.sanmar.com/PC54_JetBlack_detail.jpg", productId: "PC54", partId: "PC54-JetBlack-S", classTypeName: "Lifestyle", color: "Jet Black", singlePart: false },
  { url: "https://cdn.sanmar.com/PC54_White_fm.jpg", productId: "PC54", partId: "PC54-White-S", classTypeName: "Front Model", color: "White", singlePart: false },
  { url: "https://cdn.sanmar.com/PC54_White_bk.jpg", productId: "PC54", partId: "PC54-White-S", classTypeName: "Back Model", color: "White", singlePart: false },
  { url: "https://cdn.sanmar.com/PC54_Red_fm.jpg", productId: "PC54", partId: "PC54-Red-S", classTypeName: "Front Model", color: "Red", singlePart: false },
];

Deno.test("categorizeSanMarImages - returns all views without color filter", () => {
  const { views, mockupImages } = categorizeSanMarImages(sampleImages);

  assertNotEquals(views.front, null);
  assertNotEquals(views.rear, null);
  assertNotEquals(views.side, null);
  assertEquals(views.frontImages.length, 3);
  assertEquals(views.rearImages.length, 2);
  assertEquals(views.sideImages.length, 1);
  assertEquals(mockupImages.front.length, 3);
  assertEquals(mockupImages.back.length, 2);
  assertEquals(mockupImages.side.length, 1);
  assertEquals(mockupImages.swatch.length, 1);
});

Deno.test("categorizeSanMarImages - filters by color correctly", () => {
  const { views, mockupImages } = categorizeSanMarImages(sampleImages, "Jet Black");

  assertEquals(views.frontImages.length, 1);
  assertEquals(views.frontImages[0], "https://cdn.sanmar.com/PC54_JetBlack_fm.jpg");
  assertEquals(views.rearImages.length, 1);
  assertEquals(views.rearImages[0], "https://cdn.sanmar.com/PC54_JetBlack_bk.jpg");
  assertEquals(views.sideImages.length, 1);
  assertEquals(mockupImages.front.length, 1);
  assertEquals(mockupImages.back.length, 1);
  assertEquals(mockupImages.side.length, 1);
  assertEquals(mockupImages.swatch.length, 1);
});

Deno.test("categorizeSanMarImages - no cross-color bleed", () => {
  const { mockupImages: blackImages } = categorizeSanMarImages(sampleImages, "Jet Black");
  const { mockupImages: whiteImages } = categorizeSanMarImages(sampleImages, "White");
  const { mockupImages: redImages } = categorizeSanMarImages(sampleImages, "Red");

  for (const url of blackImages.front) {
    assertEquals(url.includes("JetBlack"), true, `Black front should only contain JetBlack URLs, got: ${url}`);
  }
  for (const url of whiteImages.front) {
    assertEquals(url.includes("White"), true, `White front should only contain White URLs, got: ${url}`);
  }
  for (const url of redImages.front) {
    assertEquals(url.includes("Red"), true, `Red front should only contain Red URLs, got: ${url}`);
  }

  assertEquals(blackImages.front.length, 1);
  assertEquals(whiteImages.front.length, 1);
  assertEquals(redImages.front.length, 1);
});

Deno.test("categorizeSanMarImages - returns correct mockup structure with swatch", () => {
  const { mockupImages } = categorizeSanMarImages(sampleImages, "Jet Black");

  assertEquals(typeof mockupImages, "object");
  assertEquals(Array.isArray(mockupImages.front), true);
  assertEquals(Array.isArray(mockupImages.back), true);
  assertEquals(Array.isArray(mockupImages.side), true);
  assertEquals(Array.isArray(mockupImages.detail), true);
  assertEquals(Array.isArray(mockupImages.swatch), true);

  assertEquals(Object.keys(mockupImages).sort(), ["back", "detail", "front", "side", "swatch"]);
});

Deno.test("categorizeSanMarImages - generic images (no color) included when filtering", () => {
  const imagesWithGeneric = [
    ...sampleImages,
    { url: "https://cdn.sanmar.com/PC54_generic_fm.jpg", productId: "PC54", partId: "", classTypeName: "Front", color: "", singlePart: false },
  ];

  const { mockupImages } = categorizeSanMarImages(imagesWithGeneric, "Navy Blue");
  assertEquals(mockupImages.front.length, 1);
  assertEquals(mockupImages.front[0], "https://cdn.sanmar.com/PC54_generic_fm.jpg");
});

Deno.test("categorizeSanMarImages - empty array returns empty result", () => {
  const { views, mockupImages } = categorizeSanMarImages([]);

  assertEquals(views.front, null);
  assertEquals(views.rear, null);
  assertEquals(views.frontImages.length, 0);
  assertEquals(mockupImages.front.length, 0);
  assertEquals(mockupImages.back.length, 0);
  assertEquals(mockupImages.swatch.length, 0);
});

Deno.test("categorizeSanMarImages - skips images with no URL", () => {
  const badImages = [
    { url: "", productId: "PC54", partId: "", classTypeName: "Front", color: "Red", singlePart: false },
    { url: null, productId: "PC54", partId: "", classTypeName: "Back", color: "Red", singlePart: false },
    { url: "https://cdn.sanmar.com/valid.jpg", productId: "PC54", partId: "", classTypeName: "Front", color: "Red", singlePart: false },
  ];

  const { mockupImages } = categorizeSanMarImages(badImages, "Red");
  assertEquals(mockupImages.front.length, 1);
  assertEquals(mockupImages.front[0], "https://cdn.sanmar.com/valid.jpg");
});

Deno.test("categorizeSanMarImages - swatch detected by URL suffix", () => {
  const swatchImages = [
    { url: "https://cdnm.sanmar.com/imglib/PC54/PC54_ATH_sw.jpg", productId: "PC54", partId: "", classTypeName: "Other", color: "", singlePart: false },
  ];

  const { mockupImages } = categorizeSanMarImages(swatchImages);
  assertEquals(mockupImages.swatch.length, 1);
  assertEquals(mockupImages.front.length, 0);
});

Deno.test("sanmarCdnUrlToProxyUrl - converts CDN URL to proxy", () => {
  const cdnUrl = "https://cdnm.sanmar.com/imglib/PC54/PC54_fm.jpg";
  const proxyUrl = sanmarCdnUrlToProxyUrl(cdnUrl, "https://example.supabase.co");

  assertEquals(proxyUrl.startsWith("https://example.supabase.co/functions/v1/sanmar-image-proxy"), true);
  assertEquals(proxyUrl.includes(encodeURIComponent(cdnUrl)), true);
});

Deno.test("sanmarCdnUrlToProxyUrl - passes through non-sanmar URLs", () => {
  const ssUrl = "https://www.ssactivewear.com/images/style/1234.jpg";
  const result = sanmarCdnUrlToProxyUrl(ssUrl, "https://example.supabase.co");
  assertEquals(result, ssUrl);
});

Deno.test("sanmarCdnUrlToProxyUrl - passes through already-proxied URLs", () => {
  const proxyUrl = "https://example.supabase.co/functions/v1/sanmar-image-proxy?url=test";
  const result = sanmarCdnUrlToProxyUrl(proxyUrl, "https://example.supabase.co");
  assertEquals(result, proxyUrl);
});

Deno.test("sanmarCdnUrlToProxyUrl - returns empty string for empty input", () => {
  assertEquals(sanmarCdnUrlToProxyUrl("", "https://example.supabase.co"), "");
});

Deno.test("convertAllSanMarUrlsToProxy - converts all image URLs", () => {
  const images = [
    { url: "https://cdnm.sanmar.com/imglib/PC54/PC54_fm.jpg", classTypeName: "Front" },
    { url: "https://cdnm.sanmar.com/imglib/PC54/PC54_bk.jpg", classTypeName: "Back" },
    { url: "", classTypeName: "None" },
  ];

  const result = convertAllSanMarUrlsToProxy(images, "https://example.supabase.co");

  assertEquals(result[0].url.includes("sanmar-image-proxy"), true);
  assertEquals(result[1].url.includes("sanmar-image-proxy"), true);
  assertEquals(result[2].url, "");
});

Deno.test("buildSanMarCdnFallbackUrl - generates all view suffixes", () => {
  const urls = buildSanMarCdnFallbackUrl("PC54");

  assertEquals(urls.length, 4);
  assertEquals(urls[0].endsWith("_fm.jpg"), true);
  assertEquals(urls[1].endsWith("_bk.jpg"), true);
  assertEquals(urls[2].endsWith("_sd.jpg"), true);
  assertEquals(urls[3].endsWith("_sw.jpg"), true);
});

Deno.test("buildSanMarCdnFallbackUrl - with color adds color-specific URLs", () => {
  const urls = buildSanMarCdnFallbackUrl("PC54", "ATH");

  assertEquals(urls.length, 8);
  assertEquals(urls[4].includes("_ATH_fm.jpg"), true);
  assertEquals(urls[5].includes("_ATH_bk.jpg"), true);
  assertEquals(urls[6].includes("_ATH_sd.jpg"), true);
  assertEquals(urls[7].includes("_ATH_sw.jpg"), true);
});

Deno.test("buildSanMarProxyUrl - generates correct proxy URL", () => {
  const url = buildSanMarProxyUrl("https://example.supabase.co", "PC54", "fm");
  assertEquals(url, "https://example.supabase.co/functions/v1/sanmar-image-proxy/PC54/fm");
});

Deno.test("buildSanMarProxyUrl - includes color parameter", () => {
  const url = buildSanMarProxyUrl("https://example.supabase.co", "PC54", "fm", "ATH");
  assertEquals(url, "https://example.supabase.co/functions/v1/sanmar-image-proxy/PC54/fm?color=ATH");
});

Deno.test("categorizeSanMarImages - CDN fallback images categorize correctly", () => {
  const cdnImages = [
    { url: "https://cdnm.sanmar.com/imglib/PC54/PC54_fm.jpg", productId: "PC54", partId: "", classTypeName: "Front", color: "", singlePart: false },
    { url: "https://cdnm.sanmar.com/imglib/PC54/PC54_ATH_fm.jpg", productId: "PC54", partId: "PC54-ATH-S", classTypeName: "Front", color: "Athletic Heather", singlePart: false },
    { url: "https://cdnm.sanmar.com/imglib/PC54/PC54_ATH_bk.jpg", productId: "PC54", partId: "PC54-ATH-S", classTypeName: "Back", color: "Athletic Heather", singlePart: false },
  ];

  const { mockupImages } = categorizeSanMarImages(cdnImages, "Athletic Heather");
  assertEquals(mockupImages.front.length >= 1, true);
  assertEquals(mockupImages.back.length, 1);
  assertEquals(mockupImages.front[0].includes("ATH"), true);
});
