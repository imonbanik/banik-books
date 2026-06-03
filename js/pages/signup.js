document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("profile-setup-form");
  const status = document.getElementById("profileSetupStatus");
  const submitButton = document.getElementById("profileSubmitButton");
  const agreement = document.getElementById("profileAgreement");
  const letterheadInput = document.getElementById("profileLetterhead");
  const letterheadPreview = document.getElementById("profileLetterheadPreview");
  const letterheadStatus = document.getElementById("profileLetterheadStatus");
  const letterheadDropzone = document.querySelector('label[for="profileLetterhead"]');
  const letterheadRemoveButton = document.getElementById("profileLetterheadRemoveButton");
  const eSignInput = document.getElementById("profileESign");
  const eSignPreview = document.getElementById("profileESignPreview");
  const eSignStatus = document.getElementById("profileESignStatus");
  const eSignDropzone = document.querySelector('label[for="profileESign"]');
  const eSignRemoveButton = document.getElementById("profileESignRemoveButton");
  const profilePhotoInput = document.getElementById("profilePhoto");
  const profilePhotoPreview = document.getElementById("profilePhotoPreview");
  const profilePhotoStatus = document.getElementById("profilePhotoStatus");
  const profilePhotoRemoveButton = document.getElementById("profilePhotoRemoveButton");
  const companyLogoInput = document.getElementById("companyLogo");
  const companyLogoDropzone = document.querySelector('label[for="companyLogo"]');
  const companyLogoPreview = document.getElementById("companyLogoPreview");
  const companyLogoPreviewCard = document.getElementById("companyLogoPreviewCard");
  const companyLogoPreviewName = document.getElementById("companyLogoPreviewName");
  const companyLogoPreviewMeta = document.getElementById("companyLogoPreviewMeta");
  const companyLogoStatus = document.getElementById("companyLogoStatus");
  const companyLogoRemoveButton = document.getElementById("companyLogoRemoveButton");
  const cropModal = document.getElementById("imageCropModal");
  const cropTitle = document.getElementById("imageCropTitle");
  const cropper = document.getElementById("imageCropper");
  const cropSource = document.getElementById("imageCropSource");
  const cropFrame = document.getElementById("imageCropFrame");
  const cropZoom = document.getElementById("imageCropZoom");
  const cropCancel = document.getElementById("imageCropCancel");
  const cropApply = document.getElementById("imageCropApply");
  const attachmentConfirmModal = document.getElementById("profileAttachmentConfirm");
  const attachmentConfirmMessage = document.getElementById("profileAttachmentConfirmMessage");
  const attachmentConfirmYes = document.getElementById("profileAttachmentConfirmYes");
  const attachmentConfirmNo = document.getElementById("profileAttachmentConfirmNo");
  const allowedLetterheadTypes = new Set(["image/png", "image/jpeg", "application/pdf"]);
  const allowedImageTypes = new Set(["image/png", "image/jpeg"]);
  const maxCroppedImageBytes = 700 * 1024;
  let pendingLetterhead = null;
  let savedLetterhead = null;
  let pendingESign = null;
  let savedESign = null;
  let pendingProfilePhoto = null;
  let savedProfilePhoto = null;
  let pendingCompanyLogo = null;
  let savedCompanyLogo = null;
  let cropState = null;
  let attachmentConfirmResolve = null;

  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }
  const currentUser = await window.BanikAuth.getCurrentUser();

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatBytes(bytes) {
    if (!bytes) return "0 KB";
    return bytes >= 1024 * 1024
      ? `${(bytes / (1024 * 1024)).toFixed(2)} MB`
      : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  function getFileType(file) {
    const type = String(file.type || "").toLowerCase();
    const name = String(file.name || "").toLowerCase();

    if (type === "image/jpg") return "image/jpeg";
    if (type) return type;
    if (name.endsWith(".pdf")) return "application/pdf";
    if (name.endsWith(".png")) return "image/png";
    if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
    return "";
  }

  function setStatus(element, message, state = "") {
    element.textContent = message;
    element.className = `letterhead-status${state ? ` letterhead-status--${state}` : ""}`;
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Could not read file."));
      reader.readAsDataURL(file);
    });
  }

  function dataUrlToUint8Array(dataUrl) {
    const encoded = String(dataUrl || "").split(",")[1] || "";
    const binary = atob(encoded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  }

  function getImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Could not load image."));
      image.src = dataUrl;
    });
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Could not optimize image."));
      reader.readAsDataURL(blob);
    });
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), type, quality);
    });
  }

  async function createOptimizedImagePayload({ sourceImage, fileName, type, crop, outputWidth, outputHeight }) {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    context.imageSmoothingQuality = "high";
    context.drawImage(
      sourceImage,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      outputWidth,
      outputHeight
    );

    const outputType = type === "image/png" ? "image/png" : "image/jpeg";
    let quality = outputType === "image/jpeg" ? 0.82 : 0.92;
    let blob = await canvasToBlob(canvas, outputType, quality);

    while (blob && blob.size > maxCroppedImageBytes && outputType === "image/jpeg" && quality > 0.58) {
      quality -= 0.08;
      blob = await canvasToBlob(canvas, outputType, quality);
    }

    if (!blob) {
      throw new Error("Could not crop image.");
    }

    const dataUrl = await blobToDataUrl(blob);

    return {
      name: fileName,
      type: outputType,
      size: blob.size,
      width: outputWidth,
      height: outputHeight,
      dataUrl,
    };
  }

  function renderImagePreview(container, asset, emptyText) {
    const removeButton =
      container === profilePhotoPreview
        ? profilePhotoRemoveButton
        : container === companyLogoPreview
          ? companyLogoRemoveButton
          : null;

    if (removeButton) {
      removeButton.hidden = !asset;
      removeButton.disabled = !asset;
    }

    if (!asset || !asset.dataUrl) {
      container.innerHTML = `<span>${escapeHtml(emptyText)}</span>`;
      if (container === companyLogoPreview) {
        companyLogoDropzone.hidden = false;
        companyLogoPreviewCard.hidden = true;
        companyLogoPreviewName.textContent = "Logo preview";
        companyLogoPreviewMeta.textContent = "300x200px · Ratio 3:2";
      }
      return;
    }

    container.innerHTML = `<img src="${asset.dataUrl}" alt="${escapeHtml(asset.name || "Uploaded image")}" />`;
    if (container === companyLogoPreview) {
      companyLogoDropzone.hidden = true;
      companyLogoPreviewCard.hidden = false;
      companyLogoPreviewName.textContent = asset.name || "Business logo";
      companyLogoPreviewMeta.textContent = `${asset.width}x${asset.height}px · Ratio ${formatAspectRatio(asset.width, asset.height)} · ${formatBytes(asset.size)}`;
    }
  }

  function closeAttachmentConfirm(confirmed) {
    attachmentConfirmModal.hidden = true;
    document.body.classList.remove("modal-open");
    if (attachmentConfirmResolve) {
      attachmentConfirmResolve(Boolean(confirmed));
      attachmentConfirmResolve = null;
    }
  }

  function confirmAttachmentRemoval(label) {
    attachmentConfirmMessage.textContent = `Are you sure you want to remove this ${label}?`;
    attachmentConfirmModal.hidden = false;
    document.body.classList.add("modal-open");
    attachmentConfirmNo.focus();
    return new Promise((resolve) => {
      attachmentConfirmResolve = resolve;
    });
  }

  function renderAssetPreview({ preview, dropzone, removeButton, savedAsset, pendingAsset, asset, mode, pendingLabel, savedLabel }) {
    const activeAsset = asset || pendingAsset || savedAsset;
    removeButton.hidden = !activeAsset;
    removeButton.disabled = !activeAsset;
    if (dropzone) {
      dropzone.hidden = Boolean(activeAsset);
    }

    if (!activeAsset) {
      preview.hidden = true;
      preview.innerHTML = "";
      return;
    }

    const type = activeAsset.type || "";
    const isImage = type.startsWith("image/");
    const badgeText = type === "application/pdf" ? "PDF" : "Image";
    const statusText = mode === "pending" ? pendingLabel : savedLabel;
    const media = isImage
      ? `<img src="${activeAsset.dataUrl}" alt="${escapeHtml(activeAsset.name)} preview" />`
      : `<object data="${activeAsset.dataUrl}" type="application/pdf" aria-label="${escapeHtml(activeAsset.name)} preview">
          <span class="letterhead-preview__file-badge">PDF</span>
        </object>`;
    const sizeText = activeAsset.width && activeAsset.height
      ? `${activeAsset.width}x${activeAsset.height}px · Ratio ${formatAspectRatio(activeAsset.width, activeAsset.height)} · ${formatBytes(activeAsset.size)}`
      : `${badgeText} · ${formatBytes(activeAsset.size)}`;

    preview.innerHTML = `
      <div class="letterhead-preview__media">${media}</div>
      <div class="letterhead-preview__copy">
        <span>${statusText}</span>
        <strong>${escapeHtml(activeAsset.name)}</strong>
        <small>${escapeHtml(type || badgeText)} · ${escapeHtml(sizeText)}</small>
      </div>
    `;
    preview.hidden = false;
  }

  function formatAspectRatio(width, height) {
    const safeWidth = Number(width || 0);
    const safeHeight = Number(height || 0);

    if (!safeWidth || !safeHeight) {
      return "-";
    }

    const divisor = getGreatestCommonDivisor(Math.round(safeWidth), Math.round(safeHeight));
    return `${Math.round(safeWidth / divisor)}:${Math.round(safeHeight / divisor)}`;
  }

  function getGreatestCommonDivisor(left, right) {
    let currentLeft = Math.abs(left);
    let currentRight = Math.abs(right);

    while (currentRight) {
      const next = currentLeft % currentRight;
      currentLeft = currentRight;
      currentRight = next;
    }

    return currentLeft || 1;
  }

  function renderLetterheadPreview(letterhead, mode = "saved") {
    renderAssetPreview({
      preview: letterheadPreview,
      dropzone: letterheadDropzone,
      removeButton: letterheadRemoveButton,
      savedAsset: savedLetterhead,
      pendingAsset: pendingLetterhead,
      asset: letterhead,
      mode,
      pendingLabel: "Ready to upload",
      savedLabel: "Saved letterhead",
    });
  }

  function renderESignPreview(eSign, mode = "saved") {
    renderAssetPreview({
      preview: eSignPreview,
      dropzone: eSignDropzone,
      removeButton: eSignRemoveButton,
      savedAsset: savedESign,
      pendingAsset: pendingESign,
      asset: eSign,
      mode,
      pendingLabel: "Ready to upload",
      savedLabel: "Saved e-signature",
    });
  }

  function updateSaveState() {
    submitButton.disabled = !agreement.checked;
  }

  async function createLetterheadPayload(file) {
    const type = getFileType(file);

    if (!allowedLetterheadTypes.has(type)) {
      throw new Error("Upload PDF, PNG, JPG, or JPEG format only.");
    }

    const payload = {
      name: file.name,
      type,
      size: file.size,
      dataUrl: await readFileAsDataUrl(file),
    };

    return hydrateLetterheadDimensions(payload);
  }

  async function hydrateLetterheadDimensions(letterhead) {
    if (
      !letterhead ||
      !letterhead.dataUrl ||
      (letterhead.width && letterhead.height)
    ) {
      return letterhead;
    }

    try {
      const type = String(letterhead.type || "");
      let width = 0;
      let height = 0;

      if (type.startsWith("image/")) {
        const image = await getImage(letterhead.dataUrl);
        width = image.naturalWidth;
        height = image.naturalHeight;
      } else if (type === "application/pdf" && window.pdfjsLib) {
        const pdf = await window.pdfjsLib.getDocument({ data: dataUrlToUint8Array(letterhead.dataUrl) }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1 });
        width = Math.round(viewport.width);
        height = Math.round(viewport.height);
      }

      if (!width || !height) {
        return letterhead;
      }

      return {
        ...letterhead,
        width,
        height,
        aspectRatio: Number((width / height).toFixed(4)),
      };
    } catch {
      return letterhead;
    }
  }

  function setCropFrameRatio(ratio) {
    const maxWidth = 260;
    const width = ratio >= 1 ? maxWidth : Math.round(maxWidth * ratio);
    const height = ratio >= 1 ? Math.round(maxWidth / ratio) : maxWidth;
    cropFrame.style.width = `${width}px`;
    cropFrame.style.height = `${height}px`;
  }

  function renderCropSource() {
    if (!cropState) return;

    const scale = cropState.baseScale * cropState.zoom;
    cropSource.style.width = `${cropState.image.naturalWidth * scale}px`;
    cropSource.style.height = `${cropState.image.naturalHeight * scale}px`;
    cropSource.style.transform = `translate(calc(-50% + ${cropState.offsetX}px), calc(-50% + ${cropState.offsetY}px))`;
  }

  async function openCropper(file, options) {
    const type = getFileType(file);

    if (!allowedImageTypes.has(type)) {
      throw new Error("Upload PNG or JPG image only.");
    }

    const dataUrl = await readFileAsDataUrl(file);
    const image = await getImage(dataUrl);

    cropTitle.textContent = options.title;
    cropSource.src = dataUrl;
    cropZoom.value = "1";
    setCropFrameRatio(options.outputWidth / options.outputHeight);
    cropModal.hidden = false;
    document.body.classList.add("modal-open");

    const frameRect = cropFrame.getBoundingClientRect();
    const baseScale = Math.max(frameRect.width / image.naturalWidth, frameRect.height / image.naturalHeight);
    cropState = {
      file,
      type,
      options,
      image,
      baseScale,
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
      drag: null,
    };
    renderCropSource();

    return new Promise((resolve) => {
      cropState.resolve = resolve;
    });
  }

  function closeCropper(result = null) {
    if (cropState && cropState.resolve) {
      cropState.resolve(result);
    }

    cropState = null;
    cropModal.hidden = true;
    cropSource.removeAttribute("src");
    document.body.classList.remove("modal-open");
  }

  async function getCroppedPayload() {
    const state = cropState;
    const cropperRect = cropper.getBoundingClientRect();
    const frameRect = cropFrame.getBoundingClientRect();
    const scale = state.baseScale * state.zoom;
    const imageWidth = state.image.naturalWidth * scale;
    const imageHeight = state.image.naturalHeight * scale;
    const imageLeft = cropperRect.left + cropperRect.width / 2 - imageWidth / 2 + state.offsetX;
    const imageTop = cropperRect.top + cropperRect.height / 2 - imageHeight / 2 + state.offsetY;
    const crop = {
      x: Math.max(0, (frameRect.left - imageLeft) / scale),
      y: Math.max(0, (frameRect.top - imageTop) / scale),
      width: Math.min(state.image.naturalWidth, frameRect.width / scale),
      height: Math.min(state.image.naturalHeight, frameRect.height / scale),
    };

    return createOptimizedImagePayload({
      sourceImage: state.image,
      fileName: state.file.name,
      type: state.type,
      crop,
      outputWidth: state.options.outputWidth,
      outputHeight: state.options.outputHeight,
    });
  }

  cropZoom.addEventListener("input", () => {
    if (!cropState) return;
    cropState.zoom = Number(cropZoom.value || 1);
    renderCropSource();
  });

  cropper.addEventListener("pointerdown", (event) => {
    if (!cropState) return;
    cropState.drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: cropState.offsetX,
      offsetY: cropState.offsetY,
    };
    cropper.setPointerCapture(event.pointerId);
  });

  cropper.addEventListener("pointermove", (event) => {
    if (!cropState || !cropState.drag) return;
    cropState.offsetX = cropState.drag.offsetX + event.clientX - cropState.drag.startX;
    cropState.offsetY = cropState.drag.offsetY + event.clientY - cropState.drag.startY;
    renderCropSource();
  });

  cropper.addEventListener("pointerup", () => {
    if (cropState) cropState.drag = null;
  });

  cropCancel.addEventListener("click", () => closeCropper(null));
  cropApply.addEventListener("click", async () => {
    cropApply.disabled = true;
    try {
      closeCropper(await getCroppedPayload());
    } catch (error) {
      window.alert(error.message);
    } finally {
      cropApply.disabled = false;
    }
  });

  attachmentConfirmYes.addEventListener("click", () => closeAttachmentConfirm(true));
  attachmentConfirmNo.addEventListener("click", () => closeAttachmentConfirm(false));
  attachmentConfirmModal.addEventListener("click", (event) => {
    if (event.target === attachmentConfirmModal) {
      closeAttachmentConfirm(false);
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !attachmentConfirmModal.hidden) {
      closeAttachmentConfirm(false);
    }
  });

  async function savePendingLetterhead() {
    if (!pendingLetterhead) return { ok: true };
    setStatus(letterheadStatus, "Uploading letterhead...");
    const result = await window.BanikAuth.saveLetterhead(pendingLetterhead);
    if (!result.ok) {
      setStatus(letterheadStatus, result.message, "error");
      return result;
    }
    savedLetterhead = result.letterhead;
    pendingLetterhead = null;
    letterheadInput.value = "";
    renderLetterheadPreview(savedLetterhead, "saved");
    setStatus(letterheadStatus, "Letterhead saved successfully.", "success");
    return result;
  }

  async function savePendingESign() {
    if (!pendingESign) return { ok: true };
    setStatus(eSignStatus, "Uploading e-signature...");
    const result = await window.BanikAuth.saveESign(pendingESign);
    if (!result.ok) {
      setStatus(eSignStatus, result.message, "error");
      return result;
    }
    savedESign = result.eSign;
    pendingESign = null;
    eSignInput.value = "";
    renderESignPreview(savedESign, "saved");
    setStatus(eSignStatus, "E-signature saved successfully.", "success");
    return result;
  }

  async function savePendingProfilePhoto() {
    if (!pendingProfilePhoto) return { ok: true };
    setStatus(profilePhotoStatus, "Saving profile photo...");
    const result = await window.BanikAuth.saveProfilePhoto(pendingProfilePhoto);
    if (!result.ok) {
      setStatus(profilePhotoStatus, result.message, "error");
      return result;
    }
    savedProfilePhoto = result.image;
    pendingProfilePhoto = null;
    profilePhotoInput.value = "";
    renderImagePreview(profilePhotoPreview, savedProfilePhoto, "No photo");
    setStatus(profilePhotoStatus, "Profile photo saved.", "success");
    return result;
  }

  async function savePendingCompanyLogo() {
    if (!pendingCompanyLogo) return { ok: true };
    setStatus(companyLogoStatus, "Saving business logo...");
    const result = await window.BanikAuth.saveCompanyLogo(pendingCompanyLogo);
    if (!result.ok) {
      setStatus(companyLogoStatus, result.message, "error");
      return result;
    }
    savedCompanyLogo = result.image;
    pendingCompanyLogo = null;
    companyLogoInput.value = "";
    renderImagePreview(companyLogoPreview, savedCompanyLogo, "No logo");
    setStatus(companyLogoStatus, "Business logo saved.", "success");
    return result;
  }

  if (!currentUser) {
    status.textContent = "Please log in before completing your profile.";
    status.className = "auth-form-status auth-form-status--error";
    form.querySelectorAll("input, select, button").forEach((control) => {
      control.disabled = true;
    });
    return;
  }

  document.getElementById("profileFullName").value = currentUser.fullName || "";
  document.getElementById("profileEmail").value = currentUser.email || "";
  document.getElementById("profileMobileNumber").value = currentUser.mobileNumber || "";
  document.getElementById("profileBusinessName").value = currentUser.companyName || currentUser.fullName || "";
  document.getElementById("profileBusinessType").value = currentUser.businessType || "Trading business";
  document.getElementById("profileCurrency").value = currentUser.currency || "BDT - Bangladeshi Taka";
  document.getElementById("profileCompanyAddress").value = currentUser.companyAddress || "";
  document.getElementById("profileFiscalYearStart").value = currentUser.fiscalYearStart || "";
  document.getElementById("profileTinNumber").value = currentUser.tinNumber || "";
  document.getElementById("profileBinNumber").value = currentUser.binNumber || "";
  document.getElementById("profileDateFormat").value = currentUser.dateFormat || "DD/MM/YYYY";
  document.getElementById("profileNumberFormat").value = currentUser.numberFormat || "1,23,456.78";
  updateSaveState();

  if (window.BanikAuth.getLetterhead) {
    const result = await window.BanikAuth.getLetterhead();
    if (result.ok && result.letterhead) {
      savedLetterhead = await hydrateLetterheadDimensions(result.letterhead);
      renderLetterheadPreview(savedLetterhead, "saved");
      setStatus(letterheadStatus, "Saved letterhead is ready.", "success");
    } else {
      renderLetterheadPreview(null);
    }
  }

  if (window.BanikAuth.getESign) {
    const result = await window.BanikAuth.getESign();
    if (result.ok && result.eSign) {
      savedESign = result.eSign;
      renderESignPreview(savedESign, "saved");
      setStatus(eSignStatus, "Saved e-signature is ready.", "success");
    } else {
      renderESignPreview(null);
    }
  }

  if (window.BanikAuth.getProfilePhoto) {
    const result = await window.BanikAuth.getProfilePhoto();
    if (result.ok && result.image) {
      savedProfilePhoto = result.image;
      renderImagePreview(profilePhotoPreview, savedProfilePhoto, "No photo");
      setStatus(profilePhotoStatus, "Saved profile photo is ready.", "success");
    }
  }

  if (window.BanikAuth.getCompanyLogo) {
    const result = await window.BanikAuth.getCompanyLogo();
    if (result.ok && result.image) {
      savedCompanyLogo = result.image;
      renderImagePreview(companyLogoPreview, savedCompanyLogo, "No logo");
      setStatus(companyLogoStatus, "Saved business logo is ready.", "success");
    }
  }

  agreement.addEventListener("change", updateSaveState);

  profilePhotoInput.addEventListener("change", async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
      setStatus(profilePhotoStatus, "Cropping profile photo...");
      const payload = await openCropper(file, { title: "Crop profile photo", outputWidth: 320, outputHeight: 320 });
      if (!payload) return;
      pendingProfilePhoto = payload;
      renderImagePreview(profilePhotoPreview, pendingProfilePhoto, "No photo");
      setStatus(profilePhotoStatus, "Ready to save.", "success");
    } catch (error) {
      setStatus(profilePhotoStatus, error.message, "error");
    } finally {
      profilePhotoInput.value = "";
    }
  });

  companyLogoInput.addEventListener("change", async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
      setStatus(companyLogoStatus, "Cropping business logo...");
      const payload = await openCropper(file, { title: "Crop business logo", outputWidth: 300, outputHeight: 200 });
      if (!payload) return;
      pendingCompanyLogo = payload;
      renderImagePreview(companyLogoPreview, pendingCompanyLogo, "No logo");
      setStatus(companyLogoStatus, "Ready to save.", "success");
    } catch (error) {
      setStatus(companyLogoStatus, error.message, "error");
    } finally {
      companyLogoInput.value = "";
    }
  });

  eSignInput.addEventListener("change", async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
      setStatus(eSignStatus, "Cropping e-signature...");
      pendingESign = await openCropper(file, { title: "Crop e-signature", outputWidth: 300, outputHeight: 100 });
      if (!pendingESign) return;
      renderESignPreview(pendingESign, "pending");
      setStatus(eSignStatus, "Ready to upload or save profile.", "success");
    } catch (error) {
      pendingESign = null;
      renderESignPreview(savedESign, savedESign ? "saved" : "pending");
      setStatus(eSignStatus, error.message, "error");
    } finally {
      eSignInput.value = "";
    }
  });

  letterheadInput.addEventListener("change", async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
      setStatus(letterheadStatus, "Checking letterhead file...");
      pendingLetterhead = await createLetterheadPayload(file);
      renderLetterheadPreview(pendingLetterhead, "pending");
      setStatus(letterheadStatus, "Ready to upload or save profile.", "success");
    } catch (error) {
      pendingLetterhead = null;
      renderLetterheadPreview(savedLetterhead, savedLetterhead ? "saved" : "pending");
      setStatus(letterheadStatus, error.message, "error");
    } finally {
      letterheadInput.value = "";
    }
  });

  profilePhotoRemoveButton.addEventListener("click", async () => {
    if (!pendingProfilePhoto && !savedProfilePhoto) return;
    if (!(await confirmAttachmentRemoval("profile photo"))) return;
    if (pendingProfilePhoto) {
      pendingProfilePhoto = null;
      renderImagePreview(profilePhotoPreview, savedProfilePhoto, "No photo");
      setStatus(profilePhotoStatus, "Pending photo cleared.");
      return;
    }
    if (!savedProfilePhoto) return;
    const result = await window.BanikAuth.removeProfilePhoto();
    if (result.ok) {
      savedProfilePhoto = null;
      renderImagePreview(profilePhotoPreview, null, "No photo");
      setStatus(profilePhotoStatus, "Profile photo removed.", "success");
    } else {
      setStatus(profilePhotoStatus, result.message, "error");
    }
  });

  companyLogoRemoveButton.addEventListener("click", async () => {
    if (!pendingCompanyLogo && !savedCompanyLogo) return;
    if (!(await confirmAttachmentRemoval("business logo"))) return;
    if (pendingCompanyLogo) {
      pendingCompanyLogo = null;
      renderImagePreview(companyLogoPreview, savedCompanyLogo, "No logo");
      setStatus(companyLogoStatus, "Pending logo cleared.");
      return;
    }
    if (!savedCompanyLogo) return;
    const result = await window.BanikAuth.removeCompanyLogo();
    if (result.ok) {
      savedCompanyLogo = null;
      renderImagePreview(companyLogoPreview, null, "No logo");
      setStatus(companyLogoStatus, "Business logo removed.", "success");
    } else {
      setStatus(companyLogoStatus, result.message, "error");
    }
  });

  letterheadRemoveButton.addEventListener("click", async () => {
    if (!pendingLetterhead && !savedLetterhead) {
      setStatus(letterheadStatus, "No saved letterhead to remove.");
      return;
    }
    if (!(await confirmAttachmentRemoval("letterhead"))) return;
    if (pendingLetterhead) {
      pendingLetterhead = null;
      renderLetterheadPreview(savedLetterhead, savedLetterhead ? "saved" : "pending");
      setStatus(letterheadStatus, savedLetterhead ? "Pending upload cleared." : "No letterhead selected.");
      return;
    }
    const result = await window.BanikAuth.removeLetterhead();
    if (result.ok) {
      savedLetterhead = null;
      renderLetterheadPreview(null);
      setStatus(letterheadStatus, "Letterhead removed.", "success");
    } else {
      setStatus(letterheadStatus, result.message, "error");
    }
  });

  eSignRemoveButton.addEventListener("click", async () => {
    if (!pendingESign && !savedESign) {
      setStatus(eSignStatus, "No saved e-signature to remove.");
      return;
    }
    if (!(await confirmAttachmentRemoval("e-signature"))) return;
    if (pendingESign) {
      pendingESign = null;
      renderESignPreview(savedESign, savedESign ? "saved" : "pending");
      setStatus(eSignStatus, savedESign ? "Pending upload cleared." : "No e-signature selected.");
      return;
    }
    const result = await window.BanikAuth.removeESign();
    if (result.ok) {
      savedESign = null;
      renderESignPreview(null);
      setStatus(eSignStatus, "E-signature removed.", "success");
    } else {
      setStatus(eSignStatus, result.message, "error");
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!agreement.checked) {
      updateSaveState();
      return;
    }

    const email = document.getElementById("profileEmail").value.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      status.textContent = "Valid email is required.";
      status.className = "auth-form-status auth-form-status--error";
      return;
    }

    submitButton.disabled = true;
    status.textContent = "Saving profile...";
    status.className = "auth-form-status";

    const result = await window.BanikAuth.updateProfile({
      fullName: document.getElementById("profileFullName").value,
      businessName: document.getElementById("profileBusinessName").value,
      mobileNumber: document.getElementById("profileMobileNumber").value,
      businessType: document.getElementById("profileBusinessType").value,
      currency: document.getElementById("profileCurrency").value,
      companyAddress: document.getElementById("profileCompanyAddress").value,
      fiscalYearStart: document.getElementById("profileFiscalYearStart").value,
      tinNumber: document.getElementById("profileTinNumber").value,
      binNumber: document.getElementById("profileBinNumber").value,
      dateFormat: document.getElementById("profileDateFormat").value,
      numberFormat: document.getElementById("profileNumberFormat").value,
    });

    if (!result.ok) {
      status.textContent = result.message;
      status.className = "auth-form-status auth-form-status--error";
      updateSaveState();
      return;
    }

    if (window.BanikApi && typeof window.BanikApi.saveSetting === "function") {
      try {
        await window.BanikApi.saveSetting("accountingPreferences", {
          currency: document.getElementById("profileCurrency").value,
          fiscalYearStart: document.getElementById("profileFiscalYearStart").value,
          dateFormat: document.getElementById("profileDateFormat").value,
          numberFormat: document.getElementById("profileNumberFormat").value,
        });
      } catch {
        // Profile save should not fail just because preference sync is temporarily unavailable.
      }
    }

    const assetSaves = [
      await savePendingProfilePhoto(),
      await savePendingCompanyLogo(),
      await savePendingLetterhead(),
      await savePendingESign(),
    ];
    const failedSave = assetSaves.find((saveResult) => !saveResult.ok);

    if (failedSave) {
      status.textContent = failedSave.message;
      status.className = "auth-form-status auth-form-status--error";
      updateSaveState();
      return;
    }

    status.textContent = "Profile saved. Opening workspace...";
    status.className = "auth-form-status auth-form-status--success";
    window.location.href = result.user.role === "admin" ? "./admin.html" : "./workspace.html";
  });
});
