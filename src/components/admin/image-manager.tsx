"use client";

import { useState, useCallback, useRef, useEffect, type DragEvent, type ChangeEvent } from "react";
import {
  collection,
  getDocs,
  doc,
  setDoc,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import Image from "next/image";
import { db, storage } from "@/lib/firebase";
import type { ManagedProduct } from "@/types";

interface UploadFile {
  file: File;
  progress: number;
  url?: string;
  error?: string;
}

export default function ImageManager() {
  const [products, setProducts] = useState<ManagedProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [mockupView, setMockupView] = useState<"front" | "back" | "sleeve" | "sideL" | "sideR">("front");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadProducts = useCallback(async () => {

    const snap = await getDocs(collection(db, "products"));
    const items: ManagedProduct[] = [];
    snap.forEach((d) => {
      const data = d.data() as ManagedProduct;
      if (data.name && data.id) items.push(data);
    });
    items.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    setProducts(items);

  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadProducts();
  }, [loadProducts]);

  const selectedProduct = products.find((p) => p.id === selectedProductId) ?? null;
  const mockups = selectedProduct?.mockupImages ?? {};
  const images = selectedProduct?.images ?? [];

  const addFiles = useCallback((files: FileList | File[]) => {
    const newFiles: UploadFile[] = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .map((f) => ({ file: f, progress: 0 }));
    setUploadFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const handleFileSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) addFiles(e.target.files);
    if (e.target) e.target.value = "";
  }, [addFiles]);

  const removeFile = (idx: number) => {
    setUploadFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const uploadAll = async () => {
    if (!selectedProductId || !uploadFiles.length) return;
    setUploading(true);

    const product = products.find((p) => p.id === selectedProductId);
    if (!product) return;

    const newUrls: string[] = [...images];
    const updatedFiles = [...uploadFiles];

    for (let i = 0; i < updatedFiles.length; i++) {
      const f = updatedFiles[i];
      if (f.url) continue; // skip already uploaded

      const path = `products/${selectedProductId}/${crypto.randomUUID()}_${f.file.name}`;
      const storageRef = ref(storage, path);

      try {
        const task = uploadBytesResumable(storageRef, f.file);
        await new Promise<void>((resolve, reject) => {
          task.on(
            "state_changed",
            (snap) => {
              const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
              setUploadFiles((prev) =>
                prev.map((pf, pi) => (pi === i ? { ...pf, progress: pct } : pf))
              );
            },
            reject,
            resolve
          );
        });
        const url = await getDownloadURL(storageRef);
        updatedFiles[i] = { ...f, progress: 100, url };
        newUrls.push(url);
        setUploadFiles([...updatedFiles]);
      } catch (err) {
        updatedFiles[i] = {
          ...f,
          error: err instanceof Error ? err.message : "Upload failed",
        };
        setUploadFiles([...updatedFiles]);
      }
    }

    // Update Firestore with new URLs
    await setDoc(
      doc(db, "products", selectedProductId),
      { images: newUrls, updatedAt: new Date().toISOString() },
      { merge: true }
    );

    setUploadFiles([]);
    setUploading(false);
    loadProducts();
  };

  const assignMockup = async (url: string) => {
    if (!selectedProductId) return;
    const updated = { ...mockups, [mockupView]: url };
    await setDoc(
      doc(db, "products", selectedProductId),
      { mockupImages: updated, updatedAt: new Date().toISOString() },
      { merge: true }
    );
    loadProducts();
  };

  const removeMockup = async () => {
    if (!selectedProductId) return;
    const updated = { ...mockups };
    delete updated[mockupView];
    await setDoc(
      doc(db, "products", selectedProductId),
      { mockupImages: updated, updatedAt: new Date().toISOString() },
      { merge: true }
    );
    loadProducts();
  };

  type ColorView = "front" | "back" | "sleeve" | "sideL" | "sideR";

  /** Assign a gallery image as the per-color mockup for a view */
  const setColorMockup = async (color: string, view: ColorView, url: string) => {
    if (!selectedProductId || !selectedProduct) return;
    await setDoc(
      doc(db, "products", selectedProductId),
      {
        mockupImagesByColor: {
          ...(selectedProduct.mockupImagesByColor ?? {}),
          [color]: { ...(selectedProduct.mockupImagesByColor?.[color] ?? {}), [view]: url },
        },
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    loadProducts();
  };

  /** Upload a file straight into a per-color view slot */
  const uploadColorMockup = async (color: string, view: ColorView, file: File) => {
    if (!selectedProductId || !selectedProduct) return;
    try {
      const path = `products/${selectedProductId}/color-mockups/${color}/${view}-${crypto.randomUUID()}.png`;
      const storageRef = ref(storage, path);
      await uploadBytesResumable(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await setColorMockup(color, view, url);
    } catch (err) {
      console.error("Color mockup upload failed", err);
      alert("Upload failed: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  const removeColorMockup = async (color: string, view: ColorView) => {
    if (!selectedProductId || !selectedProduct) return;
    const perColor = { ...(selectedProduct.mockupImagesByColor ?? {}) };
    const views = { ...(perColor[color] ?? {}) };
    delete views[view];
    if (Object.keys(views).length > 0) perColor[color] = views; else delete perColor[color];
    const payload: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (Object.keys(perColor).length > 0) payload.mockupImagesByColor = perColor;
    await setDoc(doc(db, "products", selectedProductId), payload, { merge: true });
    loadProducts();
  };

  const deleteImage = async (url: string) => {
    if (!selectedProductId || !confirm("Delete this image?")) return;
    try {
      const urlPath = decodeURIComponent(url.split("/o/")[1]?.split("?")[0] ?? "");
      if (urlPath) await deleteObject(ref(storage, urlPath));
    } catch { /* storage ref may be external */ }

    const updated = images.filter((img) => img !== url);
    await setDoc(
      doc(db, "products", selectedProductId),
      { images: updated, updatedAt: new Date().toISOString() },
      { merge: true }
    );
    loadProducts();
  };

  const remainingUploads = uploadFiles.filter((f) => !f.url && !f.error).length;

  return (
    <div className="space-y-6">
      <h3 className="font-bold font-display text-lg">Image Manager</h3>

      {/* Product Selector */}
      <div>
        <label className="block text-sm font-medium text-primary mb-1">Select Product</label>
        <select
          value={selectedProductId}
          onChange={(e) => {
            setSelectedProductId(e.target.value);
            setUploadFiles([]);
          }}
          className="w-full max-w-md p-2.5 border border-primary/20 rounded-xl bg-white text-sm text-primary focus:border-gold focus:ring-1 focus:ring-gold outline-none"
        >
          <option value="">Select a product...</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.images?.length ?? 0} images)
            </option>
          ))}
        </select>
      </div>

      {selectedProduct && (
        <>
          {/* Mockup Assignment */}
          <div className="bg-white rounded-2xl shadow-card border border-warm-sand p-6">
            <h4 className="font-bold mb-3">Mockup Images (Customizer Base)</h4>
            <p className="text-xs text-foreground/80 mb-3">
              Upload blank garment/product photos for the customizer. One per view.
            </p>
            <div className="flex gap-2 mb-3 flex-wrap">
              {(["front", "back", "sleeve", "sideL", "sideR"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setMockupView(v)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium capitalize transition-colors ${
                    mockupView === v ? "bg-primary text-white" : "bg-warm-sand text-foreground hover:bg-warm-sand/80"
                  }`}
                >
                  {v === "sideL" ? "Left Side" : v === "sideR" ? "Right Side" : v}
                </button>
              ))}
            </div>
            <div className="flex items-start gap-4">
              <div className="relative w-32 h-32 bg-warm-sand rounded-xl overflow-hidden shrink-0">
                {mockups[mockupView] ? (
                  <Image
                    src={mockups[mockupView]!}
                    alt={`${mockupView} mockup`}
                    fill
                    className="object-contain p-2"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-xs text-foreground/70">
                    No {mockupView} mockup
                  </div>
                )}
              </div>
              <div className="space-y-2 text-xs text-foreground">
                <p><strong>Front:</strong> {mockups.front ? "✓ Set" : "✗ Not set"}</p>
                <p><strong>Back:</strong> {mockups.back ? "✓ Set" : "✗ Not set"}</p>
                <p><strong>Sleeve:</strong> {mockups.sleeve ? "✓ Set" : "✗ Not set"}</p>
                <p><strong>Left Side:</strong> {mockups.sideL ? "✓ Set" : "✗ Not set"}</p>
                <p><strong>Right Side:</strong> {mockups.sideR ? "✓ Set" : "✗ Not set"}</p>
                {mockups[mockupView] && (
                  <button
                    onClick={removeMockup}
                    className="text-red-400 hover:text-red-600 transition-colors"
                  >
                    Remove {mockupView} mockup
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Color Mockups — real per-color photos (replace the tint overlay) */}
          <div className="bg-white rounded-2xl shadow-card border border-warm-sand p-6">
            <h4 className="font-bold mb-1">Color Mockups (per-color photos)</h4>
            <p className="text-xs text-foreground/80 mb-3">
              Optional real photos per garment color per view. When a color has a photo it
              replaces the tint overlay in the customizer. Upload here, or pick a gallery image.
            </p>
            {selectedProduct.colors.length === 0 ? (
              <p className="text-xs text-gold">
                This product has no colors yet — add colors in the Product editor first.
              </p>
            ) : (
              <div className="space-y-3">
                {selectedProduct.colors.map((color) => {
                  const perColor = selectedProduct.mockupImagesByColor?.[color] ?? {};
                  return (
                    <div key={color} className="border border-warm-sand rounded-xl p-3">
                      <span className="capitalize text-xs font-medium mb-2 block">{color}</span>
                      <div className="flex flex-wrap gap-3">
                        {(["front", "back", "sleeve", "sideL", "sideR"] as const).map((view) => {
                          const photo = perColor[view];
                          return (
                            <div key={view} className="w-24">
                              <div className="relative aspect-square bg-warm-sand rounded-lg overflow-hidden mb-1">
                                {photo ? (
                                  <Image src={photo} alt={`${color} ${view}`} fill className="object-cover" />
                                ) : (
                                  <div className="flex items-center justify-center h-full text-[9px] text-foreground/70 capitalize">
                                    {view === "sideL" ? "Left" : view === "sideR" ? "Right" : view}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center justify-center gap-1">
                                <label className="text-[9px] px-2 py-0.5 bg-gold text-white rounded cursor-pointer hover:bg-gold-light">
                                  Upload
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      const f = e.target.files?.[0];
                                      if (f) uploadColorMockup(color, view, f);
                                      e.target.value = "";
                                    }}
                                  />
                                </label>
                                {photo && (
                                  <button
                                    onClick={() => removeColorMockup(color, view)}
                                    className="text-[9px] text-red-400 hover:text-red-600"
                                    title={`Remove ${view} photo`}
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                              <select
                                value={photo ?? ""}
                                onChange={(e) => (e.target.value ? setColorMockup(color, view, e.target.value) : removeColorMockup(color, view))}
                                className="mt-1 w-full text-[9px] px-1 py-0.5 rounded border border-primary/15 bg-white text-foreground"
                                title={`Assign gallery image as ${view} photo`}
                              >
                                <option value="">gallery…</option>
                                {images.map((url, i) => (
                                  <option key={url} value={url}>img {i + 1}</option>
                                ))}
                              </select>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Existing Gallery */}
          <div className="bg-white rounded-2xl shadow-card border border-warm-sand p-6">
            <h4 className="font-bold mb-3">Gallery Images ({images.length})</h4>
            {images.length === 0 ? (
              <p className="text-sm text-foreground/80">No images uploaded yet.</p>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                {images.map((url) => (
                  <div key={url} className="group relative aspect-square bg-warm-sand rounded-lg overflow-hidden">
                    <Image
                      src={url}
                      alt=""
                      fill
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                        <button
                          onClick={() => assignMockup(url)}
                          className="px-2 py-1 text-[10px] bg-gold text-white rounded-md"
                          title={`Set as ${mockupView} mockup`}
                        >
                          Mockup
                        </button>
                        <button
                          onClick={() => deleteImage(url)}
                          className="px-2 py-1 text-[10px] bg-red-500 text-white rounded-md"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upload Zone */}
          <div className="bg-white rounded-2xl shadow-card border border-warm-sand p-6">
            <h4 className="font-bold mb-3">Upload Images</h4>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                dragOver ? "border-gold bg-gold/5" : "border-primary/20 hover:border-primary/40"
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <svg className="w-8 h-8 mx-auto mb-2 text-foreground/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm text-foreground">
                Drag & drop images here, or click to browse
              </p>
              <p className="text-xs text-foreground/70 mt-1">PNG, JPG, WebP supported</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* File Queue */}
            {uploadFiles.length > 0 && (
              <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
                {uploadFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 bg-warm-sand/30 rounded-lg">
                    <div className="w-10 h-10 rounded-lg bg-warm-sand overflow-hidden shrink-0">
                      {f.url ? (
                        <Image src={f.url} alt="" width={40} height={40} className="object-cover" />
                      ) : (
                        <div className="flex items-center justify-center h-full text-[10px] text-foreground/70">
                          {f.file.name.split(".").pop()?.toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs truncate">{f.file.name}</p>
                      {f.error ? (
                        <p className="text-[10px] text-red-400">{f.error}</p>
                      ) : (
                        <div className="mt-1 h-1 bg-warm-sand rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gold rounded-full transition-all"
                            style={{ width: `${f.progress}%` }}
                          />
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => removeFile(i)}
                      disabled={uploading}
                      className="text-xs text-red-400 hover:text-red-600 disabled:opacity-30"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload Button */}
            {uploadFiles.length > 0 && (
              <button
                onClick={uploadAll}
                disabled={uploading || !remainingUploads}
                className="mt-4 w-full py-2.5 bg-gold text-white rounded-xl font-semibold hover:bg-gold-light transition-colors disabled:opacity-50 btn-tactile btn-gold-tactile"
              >
                {uploading
                  ? `Uploading ${remainingUploads} file(s)...`
                  : `Upload ${remainingUploads} file(s) to ${selectedProduct.name}`}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
