/**
 * CBOR String Encoder Test Suite
 * Tests for Major Type 2 (Byte Strings) and Major Type 3 (Text Strings)
 */

import { describe, it, expect } from 'vitest'
import { useCborStringEncoder } from '../composables/useCborStringEncoder'

describe('CBOR String Encoder', () => {
  describe('Byte Strings (Major Type 2)', () => {
    describe('Definite-length encoding', () => {
      it('should encode empty byte string', () => {
        const { encodeByteString } = useCborStringEncoder()
        const result = encodeByteString(new Uint8Array([]))

        expect(result.bytes).toEqual(new Uint8Array([0x40]))
        expect(result.hex).toBe('40')
      })

      it('should encode single byte', () => {
        const { encodeByteString } = useCborStringEncoder()
        const result = encodeByteString(new Uint8Array([0xff]))

        expect(result.bytes).toEqual(new Uint8Array([0x41, 0xff]))
        expect(result.hex).toBe('41ff')
      })

      it('should encode short byte string (< 24 bytes)', () => {
        const { encodeByteString } = useCborStringEncoder()
        const data = new Uint8Array([0x01, 0x02, 0x03, 0x04])
        const result = encodeByteString(data)

        expect(result.bytes).toEqual(new Uint8Array([0x44, 0x01, 0x02, 0x03, 0x04]))
        expect(result.hex).toBe('4401020304')
      })

      it('should encode 23-byte string (direct length)', () => {
        const { encodeByteString } = useCborStringEncoder()
        const data = new Uint8Array(23).fill(0xaa)
        const result = encodeByteString(data)

        expect(result.bytes[0]).toBe(0x57)  // 0x40 + 23
        expect(result.bytes.length).toBe(24)  // 1 byte header + 23 bytes data
        expect(result.bytes.slice(1)).toEqual(data)
      })

      it('should encode 24-byte string (1-byte length)', () => {
        const { encodeByteString } = useCborStringEncoder()
        const data = new Uint8Array(24).fill(0xbb)
        const result = encodeByteString(data)

        expect(result.bytes[0]).toBe(0x58)  // Major type 2, AI=24
        expect(result.bytes[1]).toBe(24)     // Length
        expect(result.bytes.length).toBe(26) // 2 byte header + 24 bytes data
        expect(result.bytes.slice(2)).toEqual(data)
      })

      it('should encode 256-byte string (2-byte length)', () => {
        const { encodeByteString } = useCborStringEncoder()
        const data = new Uint8Array(256).fill(0xcc)
        const result = encodeByteString(data)

        expect(result.bytes[0]).toBe(0x59)  // Major type 2, AI=25
        expect(result.bytes[1]).toBe(0x01)  // Length high byte
        expect(result.bytes[2]).toBe(0x00)  // Length low byte
        expect(result.bytes.length).toBe(259) // 3 byte header + 256 bytes data
      })

      it('should encode real Cardano transaction hash', () => {
        const { encodeByteString } = useCborStringEncoder()
        // 32-byte transaction hash (typical Cardano txHash)
        const txHash = new Uint8Array([
          0x48, 0xbd, 0x01, 0xd5, 0x1e, 0x58, 0x0c, 0xde,
          0x15, 0xaf, 0xa6, 0xd2, 0x8f, 0x63, 0xd8, 0x9c,
          0x91, 0x37, 0xb9, 0x3a, 0x91, 0x0e, 0x59, 0x41,
          0x19, 0x2e, 0x26, 0xb1, 0x29, 0x06, 0x10, 0x67
        ])
        const result = encodeByteString(txHash)

        // Should use 1-byte length encoding (32 < 256)
        expect(result.bytes[0]).toBe(0x58)
        expect(result.bytes[1]).toBe(32)
        expect(result.bytes.slice(2)).toEqual(txHash)
        expect(result.hex).toBe('582048bd01d51e580cde15afa6d28f63d89c9137b93a910e5941192e26b129061067')
      })
    })

    describe('Indefinite-length encoding', () => {
      it('should encode empty indefinite byte string', () => {
        const { encodeByteStringIndefinite } = useCborStringEncoder()
        const result = encodeByteStringIndefinite([])

        // 0x5f (start) + 0xff (break)
        expect(result.bytes).toEqual(new Uint8Array([0x5f, 0xff]))
        expect(result.hex).toBe('5fff')
      })

      it('should encode single chunk', () => {
        const { encodeByteStringIndefinite } = useCborStringEncoder()
        const chunks = [new Uint8Array([0x01, 0x02, 0x03])]
        const result = encodeByteStringIndefinite(chunks)

        // 0x5f (start) + 0x43 (length 3) + data + 0xff (break)
        expect(result.bytes).toEqual(new Uint8Array([0x5f, 0x43, 0x01, 0x02, 0x03, 0xff]))
        expect(result.hex).toBe('5f43010203ff')
      })

      it('should encode multiple chunks', () => {
        const { encodeByteStringIndefinite } = useCborStringEncoder()
        const chunks = [
          new Uint8Array([0xaa, 0xbb]),
          new Uint8Array([0xcc]),
          new Uint8Array([0xdd, 0xee, 0xff])
        ]
        const result = encodeByteStringIndefinite(chunks)

        // 0x5f + (0x42 + data) + (0x41 + data) + (0x43 + data) + 0xff
        expect(result.bytes).toEqual(new Uint8Array([
          0x5f,
          0x42, 0xaa, 0xbb,
          0x41, 0xcc,
          0x43, 0xdd, 0xee, 0xff,
          0xff
        ]))
      })
    })

    describe('Options handling', () => {
      it('should reject indefinite encoding in canonical mode', () => {
        const { encodeByteString } = useCborStringEncoder({ canonical: true })
        const chunks = [new Uint8Array([0x01])]

        expect(() => encodeByteString(chunks, { indefinite: true }))
          .toThrow('Indefinite-length encoding not allowed in canonical mode')
      })
    })
  })

  describe('Text Strings (Major Type 3)', () => {
    describe('Definite-length encoding', () => {
      it('should encode empty string', () => {
        const { encodeTextString } = useCborStringEncoder()
        const result = encodeTextString('')

        expect(result.bytes).toEqual(new Uint8Array([0x60]))
        expect(result.hex).toBe('60')
      })

      it('should encode single ASCII character', () => {
        const { encodeTextString } = useCborStringEncoder()
        const result = encodeTextString('a')

        expect(result.bytes).toEqual(new Uint8Array([0x61, 0x61]))
        expect(result.hex).toBe('6161')
      })

      it('should encode short ASCII string', () => {
        const { encodeTextString } = useCborStringEncoder()
        const result = encodeTextString('IETF')

        expect(result.bytes).toEqual(new Uint8Array([0x64, 0x49, 0x45, 0x54, 0x46]))
        expect(result.hex).toBe('6449455446')
      })

      it('should encode string with quote character', () => {
        const { encodeTextString } = useCborStringEncoder()
        const result = encodeTextString('"\\')

        expect(result.bytes).toEqual(new Uint8Array([0x62, 0x22, 0x5c]))
        expect(result.hex).toBe('62225c')
      })

      it('should encode Unicode string (UTF-8)', () => {
        const { encodeTextString } = useCborStringEncoder()
        const result = encodeTextString('\u00fc')  // ü

        // ü in UTF-8 is 0xc3 0xbc (2 bytes)
        expect(result.bytes).toEqual(new Uint8Array([0x62, 0xc3, 0xbc]))
        expect(result.hex).toBe('62c3bc')
      })

      it('should encode Chinese characters (UTF-8)', () => {
        const { encodeTextString } = useCborStringEncoder()
        const result = encodeTextString('\u6c34')  // 水 (water)

        // 水 in UTF-8 is 0xe6 0xb0 0xb4 (3 bytes)
        expect(result.bytes).toEqual(new Uint8Array([0x63, 0xe6, 0xb0, 0xb4]))
        expect(result.hex).toBe('63e6b0b4')
      })

      it('should encode emoji (UTF-8)', () => {
        const { encodeTextString } = useCborStringEncoder()
        const result = encodeTextString('🔥')

        // 🔥 in UTF-8 is 0xf0 0x9f 0x94 0xa5 (4 bytes)
        expect(result.bytes).toEqual(new Uint8Array([0x64, 0xf0, 0x9f, 0x94, 0xa5]))
        expect(result.hex).toBe('64f09f94a5')
      })

      it('should encode Cardano asset name', () => {
        const { encodeTextString } = useCborStringEncoder()
        const result = encodeTextString('amount')

        // Real-world Cardano map key
        expect(result.bytes).toEqual(new Uint8Array([0x66, 0x61, 0x6d, 0x6f, 0x75, 0x6e, 0x74]))
        expect(result.hex).toBe('66616d6f756e74')
      })

      it('should encode 24-character string (1-byte length)', () => {
        const { encodeTextString } = useCborStringEncoder()
        const str = 'a'.repeat(24)
        const result = encodeTextString(str)

        expect(result.bytes[0]).toBe(0x78)  // Major type 3, AI=24
        expect(result.bytes[1]).toBe(24)    // Length
        expect(result.bytes.length).toBe(26)
      })

      it('should encode 256-character string (2-byte length)', () => {
        const { encodeTextString } = useCborStringEncoder()
        const str = 'x'.repeat(256)
        const result = encodeTextString(str)

        expect(result.bytes[0]).toBe(0x79)  // Major type 3, AI=25
        expect(result.bytes[1]).toBe(0x01)  // Length high byte
        expect(result.bytes[2]).toBe(0x00)  // Length low byte
        expect(result.bytes.length).toBe(259)
      })
    })

    describe('Indefinite-length encoding', () => {
      it('should encode empty indefinite text string', () => {
        const { encodeTextStringIndefinite } = useCborStringEncoder()
        const result = encodeTextStringIndefinite([])

        expect(result.bytes).toEqual(new Uint8Array([0x7f, 0xff]))
        expect(result.hex).toBe('7fff')
      })

      it('should encode single chunk', () => {
        const { encodeTextStringIndefinite } = useCborStringEncoder()
        const result = encodeTextStringIndefinite(['streaming'])

        // 0x7f + 0x69 (length 9) + "streaming" + 0xff
        expect(result.hex).toBe('7f6973747265616d696e67ff')
      })

      it('should encode streaming text', () => {
        const { encodeTextStringIndefinite } = useCborStringEncoder()
        const chunks = ['stream', 'ing']
        const result = encodeTextStringIndefinite(chunks)

        // 0x7f + (0x66 + "stream") + (0x63 + "ing") + 0xff
        expect(result.hex).toBe('7f6673747265616d63696e67ff')
      })
    })

    describe('Edge cases', () => {
      it('should handle null character in string', () => {
        const { encodeTextString } = useCborStringEncoder()
        const result = encodeTextString('a\u0000b')

        expect(result.bytes).toEqual(new Uint8Array([0x63, 0x61, 0x00, 0x62]))
      })

      it('should handle newline characters', () => {
        const { encodeTextString } = useCborStringEncoder()
        const result = encodeTextString('a\nb')

        expect(result.bytes).toEqual(new Uint8Array([0x63, 0x61, 0x0a, 0x62]))
      })
    })
  })

  describe('String length limits', () => {
    it('should respect maxOutputSize option', () => {
      const { encodeTextString } = useCborStringEncoder({ maxOutputSize: 10 })
      const largeString = 'x'.repeat(1000)

      expect(() => encodeTextString(largeString))
        .toThrow('Encoded output exceeds maximum size')
    })
  })
})
