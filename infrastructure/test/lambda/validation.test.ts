import {
  extractFileExtension,
  getFileMimeType,
  sanitizeFileName,
  validateFileName,
  validateFileSize,
  validateFileType,
} from "../../src/lambda/shared/validation";
import {
  FILE_LIMITS,
  SUPPORTED_MIME_TYPES,
} from "../../src/lambda/shared/constants";

describe("validation helpers", () => {
  describe("validateFileSize", () => {
    it("accepts files under the maximum size", () => {
      const result = validateFileSize(FILE_LIMITS.MAX_FILE_SIZE - 1024);
      expect(result.success).toBe(true);
    });

    it("accepts files exactly at the limit", () => {
      const result = validateFileSize(FILE_LIMITS.MAX_FILE_SIZE);
      expect(result.success).toBe(true);
    });

    it("rejects files exceeding the limit", () => {
      const result = validateFileSize(FILE_LIMITS.MAX_FILE_SIZE + 1);
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/exceeds/);
    });

    it("rejects zero-byte files", () => {
      const result = validateFileSize(0);
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/zero/);
    });

    it("rejects negative sizes", () => {
      const result = validateFileSize(-50);
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/negative/);
    });
  });

  describe("validateFileType", () => {
    it("accepts exact MIME matches", () => {
      const result = validateFileType("application/pdf");
      expect(result.success).toBe(true);
    });

    it("accepts wildcard matches", () => {
      const extendedTypes = [...SUPPORTED_MIME_TYPES, "image/*"];
      const result = validateFileType("image/png", extendedTypes);
      expect(result.success).toBe(true);
    });

    it("rejects unsupported types", () => {
      const result = validateFileType("application/x-msdownload");
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/not supported/i);
    });

    it("handles empty strings", () => {
      const result = validateFileType("");
      expect(result.success).toBe(false);
    });
  });

  describe("validateFileName", () => {
    it("accepts safe filenames", () => {
      const result = validateFileName("report-final.pdf");
      expect(result.success).toBe(true);
    });

    it("rejects overly long filenames", () => {
      const longName = `${"a".repeat(260)}.txt`;
      const result = validateFileName(longName);
      expect(result.success).toBe(false);
    });

    it("rejects empty filenames", () => {
      const result = validateFileName("");
      expect(result.success).toBe(false);
    });

    it("sanitizes filenames with only invalid characters", () => {
      const result = validateFileName("@@@@");
      expect(result.success).toBe(true);
      expect(sanitizeFileName("@@@@")).toBe("____");
    });
  });

  describe("sanitizeFileName", () => {
    it("strips directory components and unsafe characters", () => {
      const sanitized = sanitizeFileName("../../../../etc/passwd");
      expect(sanitized).toBe("passwd");
    });

    it("replaces invalid characters with underscores", () => {
      const sanitized = sanitizeFileName("file*with?chars.txt");
      expect(sanitized).toBe("file_with_chars.txt");
    });
  });

  describe("extractFileExtension", () => {
    it("returns lowercase extension", () => {
      expect(extractFileExtension("Archive.TAR.GZ")).toBe("gz");
    });

    it("returns empty string when no extension exists", () => {
      expect(extractFileExtension("README")).toBe("");
    });
  });

  describe("getFileMimeType", () => {
    it("maps known extensions to MIME types", () => {
      expect(getFileMimeType("photo.jpeg")).toBe("image/jpeg");
    });

    it("returns undefined for unknown extensions", () => {
      expect(getFileMimeType("archive.custom")).toBeUndefined();
    });
  });
});
