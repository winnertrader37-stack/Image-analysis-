/* =========================================
   NAOL ANALYSER
   Image Preview and Metadata Engine
   ========================================= */

"use strict";

const $ = (id) => document.getElementById(id);

const imageInput = $("imageInput");
const uploadArea = $("uploadArea");
const previewSection = $("previewSection");
const imagePreview = $("imagePreview");
const removeImageButton = $("removeImage");

let currentObjectURL = null;
let currentFile = null;


/* =========================================
   GENERAL HELPERS
   ========================================= */

function setText(id, value) {
    const element = $(id);

    if (element) {
        element.textContent =
            value === null ||
            value === undefined ||
            value === ""
                ? "—"
                : String(value);
    }
}


function formatFileSize(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) {
        return "Unknown";
    }

    if (bytes < 1024) {
        return bytes + " bytes";
    }

    if (bytes < 1024 * 1024) {
        return (bytes / 1024).toFixed(1) + " KB";
    }

    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}


function formatDate(value) {
    if (!value) {
        return "Not available";
    }

    const date = value instanceof Date
        ? value
        : new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return new Intl.DateTimeFormat(
        undefined,
        {
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
        }
    ).format(date);
}


function resetMetadata() {
    [
        "infoFileName",
        "infoFileSize",
        "infoDimensions",
        "infoFileType",
        "cameraMake",
        "cameraModel",
        "captureDate",
        "imageOrientation",
        "gpsLatitude",
        "gpsLongitude"
    ].forEach((id) => setText(id, "—"));

    setText("gpsStatus", "Waiting for image");
}


function showMessage(message) {
    window.alert(message);
}


/* =========================================
   FILE INFORMATION
   ========================================= */

function displayBasicInformation(file, width, height) {
    setText("fileName", file.name);
    setText("fileSize", formatFileSize(file.size));

    setText("infoFileName", file.name);
    setText("infoFileSize", formatFileSize(file.size));

    setText(
        "infoDimensions",
        width + " × " + height + " px"
    );

    setText(
        "infoFileType",
        file.type || "Unknown"
    );
}


/* =========================================
   IMAGE PREVIEW
   ========================================= */

function showPreview(file) {
    return new Promise((resolve, reject) => {
        if (currentObjectURL) {
            URL.revokeObjectURL(currentObjectURL);
            currentObjectURL = null;
        }

        currentObjectURL = URL.createObjectURL(file);

        const image = new Image();

        image.onload = function () {
            imagePreview.src = currentObjectURL;

            previewSection.hidden = false;

            displayBasicInformation(
                file,
                image.naturalWidth,
                image.naturalHeight
            );

            resolve({
                width: image.naturalWidth,
                height: image.naturalHeight
            });
        };

        image.onerror = function () {
            URL.revokeObjectURL(currentObjectURL);
            currentObjectURL = null;

            reject(
                new Error(
                    "The selected file could not be opened as an image."
                )
            );
        };

        image.src = currentObjectURL;
    });
}


/* =========================================
   EXIF METADATA
   ========================================= */

async function readMetadata(file) {
    if (typeof window.exifr === "undefined") {
        setText(
            "cameraMake",
            "Metadata library unavailable"
        );

        setText(
            "gpsStatus",
            "Metadata unavailable"
        );

        return;
    }

    try {
        const data = await window.exifr.parse(file, {
            gps: true,
            exif: true,
            tiff: true,
            ifd0: true
        });

        if (!data) {
            showNoMetadata();
            return;
        }

        // Camera manufacturer
        setText(
            "cameraMake",
            data.Make || "Not recorded"
        );

        // Camera model
        setText(
            "cameraModel",
            data.Model || "Not recorded"
        );

        // Original capture date
        const date =
            data.DateTimeOriginal ||
            data.CreateDate ||
            data.ModifyDate;

        setText(
            "captureDate",
            date ? formatDate(date) : "Not recorded"
        );

        // Orientation
        const orientationNames = {
            1: "Normal",
            2: "Mirrored",
            3: "Rotated 180°",
            4: "Mirrored vertically",
            5: "Mirrored and rotated",
            6: "Rotated 90°",
            7: "Mirrored and rotated",
            8: "Rotated 270°"
        };

        const orientation = data.Orientation;

        setText(
            "imageOrientation",
            orientationNames[orientation] ||
            (orientation ? String(orientation) : "Not recorded")
        );

        // GPS coordinates
        const latitude = data.latitude;
        const longitude = data.longitude;

        if (
            Number.isFinite(latitude) &&
            Number.isFinite(longitude)
        ) {
            setText(
                "gpsLatitude",
                latitude.toFixed(6) + "°"
            );

            setText(
                "gpsLongitude",
                longitude.toFixed(6) + "°"
            );

            setText(
                "gpsStatus",
                "Coordinates found"
            );
        } else {
            setText(
                "gpsStatus",
                "No GPS metadata"
            );

            setText("gpsLatitude", "Not available");
            setText("gpsLongitude", "Not available");
        }

    } catch (error) {
        console.error("Metadata analysis error:", error);

        showNoMetadata();
    }
}


function showNoMetadata() {
    setText("cameraMake", "Not available");
    setText("cameraModel", "Not available");
    setText("captureDate", "Not available");
    setText("imageOrientation", "Not available");

    setText("gpsStatus", "No GPS metadata");

    setText("gpsLatitude", "Not available");
    setText("gpsLongitude", "Not available");
}


/* =========================================
   IMAGE SELECTION
   ========================================= */

async function handleImageSelection(file) {
    if (!file) {
        return;
    }

    if (!file.type.startsWith("image/")) {
        showMessage(
            "Please select a valid image file."
        );

        imageInput.value = "";
        return;
    }

    // Limit very large files to protect browser memory.
    const maximumSize = 30 * 1024 * 1024;

    if (file.size > maximumSize) {
        showMessage(
            "This image is larger than 30 MB. " +
            "Please choose a smaller image."
        );

        imageInput.value = "";
        return;
    }

    currentFile = file;

    resetMetadata();

    try {
        await showPreview(file);

        // Metadata processing starts after preview succeeds.
        await readMetadata(file);

        // Bring preview into view on mobile.
        previewSection.scrollIntoView({
            behavior: "smooth",
            block: "nearest"
        });

    } catch (error) {
        console.error("Image preview error:", error);

        showMessage(
            "Unable to open this image. " +
            "Please choose a different image."
        );

        clearImage();
    }
}


/* =========================================
   CLEAR IMAGE
   ========================================= */

function clearImage() {
    if (currentObjectURL) {
        URL.revokeObjectURL(currentObjectURL);
        currentObjectURL = null;
    }

    currentFile = null;

    imageInput.value = "";

    imagePreview.removeAttribute("src");

    previewSection.hidden = true;

    resetMetadata();
}


/* =========================================
   INPUT EVENTS
   ========================================= */

imageInput.addEventListener("change", async function (event) {
    const file = event.target.files &&
                 event.target.files[0];

    await handleImageSelection(file);
});


removeImageButton.addEventListener("click", function () {
    clearImage();

    uploadArea.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });
});


/* =========================================
   DRAG AND DROP
   ========================================= */

uploadArea.addEventListener("dragover", function (event) {
    event.preventDefault();

    uploadArea.classList.add("drag-over");
});


uploadArea.addEventListener("dragleave", function () {
    uploadArea.classList.remove("drag-over");
});


uploadArea.addEventListener("drop", async function (event) {
    event.preventDefault();

    uploadArea.classList.remove("drag-over");

    const files = event.dataTransfer &&
                  event.dataTransfer.files;

    if (files && files.length > 0) {
        await handleImageSelection(files[0]);
    }
});


/* =========================================
   CLEANUP
   ========================================= */

window.addEventListener("beforeunload", function () {
    if (currentObjectURL) {
        URL.revokeObjectURL(currentObjectURL);
    }
});


/* =========================================
   INITIAL STATE
   ========================================= */

resetMetadata();

console.log("Naol Analyser initialized.");
