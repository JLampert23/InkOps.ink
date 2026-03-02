import { assertEquals, assertNotEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  categorizeSanMarImages,
  type MockupImageResult,
} from "./image-cache.ts";

const sampleImages = [
  { url: "https://cdn.sanmar.com/PC54_JetBlack_fm.jpg", productId: "PC54", partId: "PC54-JetBlack-S", classTypeName: "Front Model", color: "Jet Black", singlePart: false },
  { url: "https://cdn.sanmar.com/PC54_JetBlack_bm.jpg", productId: "PC54", partId: "PC54-JetBlack-S", classTypeName: "Back Model", color: "Jet Black", singlePart: false },
  { url: "https://cdn.sanmar.com/PC54_JetBlack_side.jpg", productId: "PC54", partId: "PC54-JetBlack-S", classTypeName: "Side", color: "Jet Black", singlePart: false },
  { url: "https://cdn.sanmar.com/PC54_JetBlack_detail.jpg", productId: "PC54", partId: "PC54-JetBlack-S", classTypeName: "Lifestyle", color: "Jet Black", singlePart: false },
  { url: "https://cdn.sanmar.com/PC54_White_fm.jpg", productId: "PC54", partId: "PC54-White-S", classTypeName: "Front Model", color: "White", singlePart: false },
  { url: "https://cdn.sanmar.com/PC54_White_bm.jpg", productId: "PC54", partId: "PC54-White-S", classTypeName: "Back Model", color: "White", singlePart: false },
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
});

Deno.test("categorizeSanMarImages - filters by color correctly", () => {
  const { views, mockupImages } = categorizeSanMarImages(sampleImages, "Jet Black");

  assertEquals(views.frontImages.length, 1);
  assertEquals(views.frontImages[0], "https://cdn.sanmar.com/PC54_JetBlack_fm.jpg");
  assertEquals(views.rearImages.length, 1);
  assertEquals(views.rearImages[0], "https://cdn.sanmar.com/PC54_JetBlack_bm.jpg");
  assertEquals(views.sideImages.length, 1);
  assertEquals(mockupImages.front.length, 1);
  assertEquals(mockupImages.back.length, 1);
  assertEquals(mockupImages.side.length, 1);
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

Deno.test("categorizeSanMarImages - returns correct mockup structure", () => {
  const { mockupImages } = categorizeSanMarImages(sampleImages, "Jet Black");

  assertEquals(typeof mockupImages, "object");
  assertEquals(Array.isArray(mockupImages.front), true);
  assertEquals(Array.isArray(mockupImages.back), true);
  assertEquals(Array.isArray(mockupImages.side), true);
  assertEquals(Array.isArray(mockupImages.detail), true);

  assertEquals(Object.keys(mockupImages).sort(), ["back", "detail", "front", "side"]);
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

Deno.test("categorizeSanMarImages - fallback CDN images categorize correctly", () => {
  const cdnImages = [
    { url: "https://cdnm.sanmar.com/imglib/PC54/PC54_fm.jpg", productId: "PC54", partId: "", classTypeName: "Front", color: "", singlePart: false },
    { url: "https://cdnm.sanmar.com/imglib/PC54/PC54_ATH_fm.jpg", productId: "PC54", partId: "PC54-ATH-S", classTypeName: "Front", color: "Athletic Heather", singlePart: false },
    { url: "https://cdnm.sanmar.com/imglib/PC54/PC54_ATH_bm.jpg", productId: "PC54", partId: "PC54-ATH-S", classTypeName: "Back", color: "Athletic Heather", singlePart: false },
  ];

  const { mockupImages } = categorizeSanMarImages(cdnImages, "Athletic Heather");
  assertEquals(mockupImages.front.length >= 1, true);
  assertEquals(mockupImages.back.length, 1);
  assertEquals(mockupImages.front[0].includes("ATH"), true);
});
