import { describe, it, expect } from 'vitest'
import { validateUtf8Strict, validateCanonicalInteger, compareBytes } from '../utils'

describe('Security: UTF-8 Validation', () => {
  describe('validateUtf8Strict - Valid UTF-8', () => {
    it('should accept valid ASCII', () => {
      const bytes = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]) // "Hello"
      expect(() => validateUtf8Strict(bytes)).not.toThrow()
    })

    it('should accept valid 2-byte sequences', () => {
      const bytes = new Uint8Array([0xc3, 0xa9]) // "é" (U+00E9)
      expect(() => validateUtf8Strict(bytes)).not.toThrow()
    })

    it('should accept valid 3-byte sequences', () => {
      const bytes = new Uint8Array([0xe2, 0x82, 0xac]) // "€" (U+20AC)
      expect(() => validateUtf8Strict(bytes)).not.toThrow()
    })

    it('should accept valid 4-byte sequences', () => {
      const bytes = new Uint8Array([0xf0, 0x9f, 0x98, 0x80]) // "😀" (U+1F600)
      expect(() => validateUtf8Strict(bytes)).not.toThrow()
    })
  })

  describe('validateUtf8Strict - Invalid Start Bytes', () => {
    it('should reject 0xC0 (invalid start byte)', () => {
      const bytes = new Uint8Array([0xc0, 0x80])
      expect(() => validateUtf8Strict(bytes)).toThrow(/Invalid UTF-8 start byte/)
    })

    it('should reject 0xC1 (invalid start byte)', () => {
      const bytes = new Uint8Array([0xc1, 0x80])
      expect(() => validateUtf8Strict(bytes)).toThrow(/Invalid UTF-8 start byte/)
    })

    it('should reject 0xF5-0xFF (invalid start bytes)', () => {
      const bytes = new Uint8Array([0xf5, 0x80, 0x80, 0x80])
      expect(() => validateUtf8Strict(bytes)).toThrow(/Invalid UTF-8 start byte/)
    })
  })

  describe('validateUtf8Strict - Overlong Encodings', () => {
    it('should reject overlong 2-byte encoding of "/" (security vulnerability)', () => {
      // "/" is 0x2f, should be 1 byte, not 2
      const bytes = new Uint8Array([0xc0, 0xaf])
      expect(() => validateUtf8Strict(bytes)).toThrow(/Invalid UTF-8 start byte/)
    })

    it('should reject overlong 2-byte encoding of valid character', () => {
      // U+007F encoded as 2 bytes instead of 1
      const bytes = new Uint8Array([0xc1, 0xbf])
      expect(() => validateUtf8Strict(bytes)).toThrow(/Invalid UTF-8 start byte/)
    })

    it('should reject overlong 3-byte encoding', () => {
      // U+007F encoded as 3 bytes instead of 1
      const bytes = new Uint8Array([0xe0, 0x81, 0xbf])
      expect(() => validateUtf8Strict(bytes)).toThrow(/Overlong UTF-8/)
    })

    it('should reject overlong 4-byte encoding', () => {
      // U+00FF encoded as 4 bytes instead of 2
      const bytes = new Uint8Array([0xf0, 0x80, 0x83, 0xbf])
      expect(() => validateUtf8Strict(bytes)).toThrow(/Overlong UTF-8/)
    })
  })

  describe('validateUtf8Strict - Surrogate Codepoints', () => {
    it('should reject high surrogate U+D800', () => {
      const bytes = new Uint8Array([0xed, 0xa0, 0x80])
      expect(() => validateUtf8Strict(bytes)).toThrow(/surrogate/)
    })

    it('should reject low surrogate U+DFFF', () => {
      const bytes = new Uint8Array([0xed, 0xbf, 0xbf])
      expect(() => validateUtf8Strict(bytes)).toThrow(/surrogate/)
    })
  })

  describe('validateUtf8Strict - Invalid Continuation Bytes', () => {
    it('should reject invalid continuation byte in 2-byte sequence', () => {
      const bytes = new Uint8Array([0xc2, 0x00]) // Second byte should be 0x80-0xBF
      expect(() => validateUtf8Strict(bytes)).toThrow(/continuation byte/)
    })

    it('should reject invalid continuation byte in 3-byte sequence', () => {
      const bytes = new Uint8Array([0xe0, 0xa0, 0x00])
      expect(() => validateUtf8Strict(bytes)).toThrow(/continuation byte/)
    })
  })

  describe('validateUtf8Strict - Incomplete Sequences', () => {
    it('should reject incomplete 2-byte sequence', () => {
      const bytes = new Uint8Array([0xc2])
      expect(() => validateUtf8Strict(bytes)).toThrow(/Incomplete UTF-8/)
    })

    it('should reject incomplete 3-byte sequence', () => {
      const bytes = new Uint8Array([0xe0, 0xa0])
      expect(() => validateUtf8Strict(bytes)).toThrow(/Incomplete UTF-8/)
    })

    it('should reject incomplete 4-byte sequence', () => {
      const bytes = new Uint8Array([0xf0, 0x90, 0x80])
      expect(() => validateUtf8Strict(bytes)).toThrow(/Incomplete UTF-8/)
    })
  })

  describe('validateUtf8Strict - Codepoint Range', () => {
    it('should reject codepoints beyond U+10FFFF', () => {
      // Attempt to encode U+110000 (beyond max)
      const bytes = new Uint8Array([0xf4, 0x90, 0x80, 0x80])
      expect(() => validateUtf8Strict(bytes)).toThrow(/exceeds maximum/)
    })
  })
})

describe('Security: Canonical Integer Validation', () => {
  describe('validateCanonicalInteger - Valid Canonical Forms', () => {
    it('should accept value 10 with direct encoding (AI = 10)', () => {
      expect(() => validateCanonicalInteger(10, 10)).not.toThrow()
    })

    it('should accept value 100 with 1-byte encoding (AI = 24)', () => {
      expect(() => validateCanonicalInteger(100, 24)).not.toThrow()
    })

    it('should accept value 1000 with 2-byte encoding (AI = 25)', () => {
      expect(() => validateCanonicalInteger(1000, 25)).not.toThrow()
    })

    it('should accept value 1000000 with 4-byte encoding (AI = 26)', () => {
      expect(() => validateCanonicalInteger(1000000, 26)).not.toThrow()
    })

    it('should accept value > 4294967295 with 8-byte encoding (AI = 27)', () => {
      expect(() => validateCanonicalInteger(10000000000n, 27)).not.toThrow()
    })
  })

  describe('validateCanonicalInteger - Non-Canonical Forms', () => {
    it('should reject value 10 encoded with AI = 24 (should be direct)', () => {
      expect(() => validateCanonicalInteger(10, 24)).toThrow(/Non-canonical integer/)
    })

    it('should reject value 100 encoded with AI = 25 (should be 1-byte)', () => {
      expect(() => validateCanonicalInteger(100, 25)).toThrow(/Non-canonical integer/)
    })

    it('should reject value 1000 encoded with AI = 26 (should be 2-byte)', () => {
      expect(() => validateCanonicalInteger(1000, 26)).toThrow(/Non-canonical integer/)
    })

    it('should reject value 100000 encoded with AI = 27 (should be 4-byte)', () => {
      expect(() => validateCanonicalInteger(100000, 27)).toThrow(/Non-canonical integer/)
    })
  })

  describe('validateCanonicalInteger - Edge Cases', () => {
    it('should validate value 0 with AI = 0', () => {
      expect(() => validateCanonicalInteger(0, 0)).not.toThrow()
    })

    it('should validate value 23 with AI = 23 (max direct)', () => {
      expect(() => validateCanonicalInteger(23, 23)).not.toThrow()
    })

    it('should validate value 24 with AI = 24 (min 1-byte)', () => {
      expect(() => validateCanonicalInteger(24, 24)).not.toThrow()
    })

    it('should validate value 255 with AI = 24 (max 1-byte)', () => {
      expect(() => validateCanonicalInteger(255, 24)).not.toThrow()
    })

    it('should validate value 256 with AI = 25 (min 2-byte)', () => {
      expect(() => validateCanonicalInteger(256, 25)).not.toThrow()
    })

    it('should validate value 65535 with AI = 25 (max 2-byte)', () => {
      expect(() => validateCanonicalInteger(65535, 25)).not.toThrow()
    })

    it('should validate value 65536 with AI = 26 (min 4-byte)', () => {
      expect(() => validateCanonicalInteger(65536, 26)).not.toThrow()
    })

    it('should validate value 4294967295 with AI = 26 (max 4-byte)', () => {
      expect(() => validateCanonicalInteger(4294967295, 26)).not.toThrow()
    })

    it('should validate value 4294967296 with AI = 27 (min 8-byte)', () => {
      expect(() => validateCanonicalInteger(4294967296n, 27)).not.toThrow()
    })
  })
})

describe('Security: Byte Array Comparison', () => {
  describe('compareBytes - Length Comparison', () => {
    it('should return negative when first array is shorter', () => {
      const a = new Uint8Array([0x01])
      const b = new Uint8Array([0x01, 0x02])
      expect(compareBytes(a, b)).toBeLessThan(0)
    })

    it('should return positive when first array is longer', () => {
      const a = new Uint8Array([0x01, 0x02])
      const b = new Uint8Array([0x01])
      expect(compareBytes(a, b)).toBeGreaterThan(0)
    })
  })

  describe('compareBytes - Lexicographic Comparison', () => {
    it('should return 0 for identical arrays', () => {
      const a = new Uint8Array([0x01, 0x02, 0x03])
      const b = new Uint8Array([0x01, 0x02, 0x03])
      expect(compareBytes(a, b)).toBe(0)
    })

    it('should return negative when first differs with lower byte', () => {
      const a = new Uint8Array([0x01, 0x02, 0x03])
      const b = new Uint8Array([0x01, 0x02, 0x04])
      expect(compareBytes(a, b)).toBeLessThan(0)
    })

    it('should return positive when first differs with higher byte', () => {
      const a = new Uint8Array([0x01, 0x02, 0x04])
      const b = new Uint8Array([0x01, 0x02, 0x03])
      expect(compareBytes(a, b)).toBeGreaterThan(0)
    })
  })

  describe('compareBytes - Edge Cases', () => {
    it('should handle empty arrays', () => {
      const a = new Uint8Array([])
      const b = new Uint8Array([])
      expect(compareBytes(a, b)).toBe(0)
    })

    it('should handle empty vs non-empty', () => {
      const a = new Uint8Array([])
      const b = new Uint8Array([0x01])
      expect(compareBytes(a, b)).toBeLessThan(0)
    })
  })
})
