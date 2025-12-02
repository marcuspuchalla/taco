/**
 * CBOR Tag Parser Tests
 * Major Type 6 (Semantic Tags)
 * Following RFC 8949 specification
 */

import { describe, it, expect } from 'vitest'
import { useCborTag } from '../composables/useCborTag'

describe('useCborTag', () => {
  describe('Standard Tags (0-5)', () => {
    describe('Tag 0: Standard Date/Time String (RFC 3339)', () => {
      it('should parse tag 0 with ISO 8601 date string', () => {
        const { parseTag } = useCborTag()

        // RFC 8949 Example: 0("2013-03-21T20:04:00Z")
        // 0xc0 = tag 0, followed by text string
        const result = parseTag('c074323031332d30332d3231543230 3a30343a30305a'.replace(/\s/g, ''))
        expect(result.value).toEqual({
          tag: 0,
          value: '2013-03-21T20:04:00Z'
        })
        expect(result.bytesRead).toBe(22) // 1 (tag) + 1 (string header) + 20 (string data)
      })

      it('should parse tag 0 with date string including milliseconds', () => {
        const { parseTag } = useCborTag()

        // "2023-12-25T15:30:45.123Z"
        const result = parseTag('c07818323032332d31322d32355431353a33303a34352e3132335a')
        expect(result.value).toEqual({
          tag: 0,
          value: '2023-12-25T15:30:45.123Z'
        })
      })

      it('should parse tag 0 with timezone offset', () => {
        const { parseTag } = useCborTag()

        // "2023-01-01T00:00:00+05:30"
        const result = parseTag('c07819323032332d30312d30315430303a30303a30302b30353a3330')
        expect(result.value.tag).toBe(0)
        expect(result.value.value).toBe('2023-01-01T00:00:00+05:30')
      })
    })

    describe('Tag 1: Epoch-based Date/Time', () => {
      it('should parse tag 1 with positive integer (epoch timestamp)', () => {
        const { parseTag } = useCborTag()

        // RFC 8949 Example: 1(1363896240)
        // 0xc1 = tag 1, 0x1a = 4-byte uint
        const result = parseTag('c11a514b67b0')
        expect(result.value).toEqual({
          tag: 1,
          value: 1363896240
        })
        expect(result.bytesRead).toBe(6)
      })

      it('should parse tag 1 with negative integer (before epoch)', () => {
        const { parseTag } = useCborTag()

        // 1(-1000000) - before Unix epoch
        const result = parseTag('c13a000f423f')
        expect(result.value).toEqual({
          tag: 1,
          value: -1000000
        })
      })

      it('should parse tag 1 with float64 (fractional seconds)', () => {
        const { parseTag } = useCborTag()

        // 1(1363896240.5) - with milliseconds
        const result = parseTag('c1fb41d452d9ec200000')
        expect(result.value.tag).toBe(1)
        expect(result.value.value).toBeCloseTo(1363896240.5, 1)
      })
    })

    describe('Tag 2: Positive Bignum', () => {
      it('should parse tag 2 with byte string (unsigned bignum)', () => {
        const { parseTag } = useCborTag()

        // RFC 8949: 2(h'010000000000000000') = 2^64
        // 0xc2 = tag 2, 0x49 = 9-byte byte string
        // Parser converts bignum to BigInt value
        const result = parseTag('c249010000000000000000')
        expect(result.value.tag).toBe(2)
        expect(result.value.value).toBe(18446744073709551616n)
      })

      it('should parse tag 2 with small bignum', () => {
        const { parseTag } = useCborTag()

        // 2(h'0100') = 256
        // Parser converts bignum to BigInt value
        const result = parseTag('c2420100')
        expect(result.value.tag).toBe(2)
        expect(result.value.value).toBe(256n)
      })

      it('should parse tag 2 with empty byte string (value 0)', () => {
        const { parseTag } = useCborTag()

        // 2(h'') = 0
        // Parser converts bignum to BigInt value
        const result = parseTag('c240')
        expect(result.value.tag).toBe(2)
        expect(result.value.value).toBe(0n)
      })
    })

    describe('Tag 3: Negative Bignum', () => {
      it('should parse tag 3 with byte string (negative bignum)', () => {
        const { parseTag } = useCborTag()

        // RFC 8949: 3(h'010000000000000000') = -2^64 - 1
        // Parser converts bignum to BigInt value
        const result = parseTag('c349010000000000000000')
        expect(result.value.tag).toBe(3)
        expect(result.value.value).toBe(-18446744073709551617n)
      })

      it('should parse tag 3 with small negative bignum', () => {
        const { parseTag } = useCborTag()

        // 3(h'0100') = -257
        // Parser converts bignum to BigInt value
        const result = parseTag('c3420100')
        expect(result.value.tag).toBe(3)
        expect(result.value.value).toBe(-257n)
      })
    })

    describe('Tag 4: Decimal Fraction [exponent, mantissa]', () => {
      it('should parse tag 4 with array [exponent, mantissa]', () => {
        const { parseTag } = useCborTag()

        // RFC 8949: 4([-2, 27315]) = 273.15
        // 0xc4 = tag 4, 0x82 = array(2), 0x21 = -2, 0x196ab3 = 27315
        const result = parseTag('c48221196ab3')
        expect(result.value.tag).toBe(4)
        expect(result.value.value).toEqual([-2, 27315])
        expect(result.bytesRead).toBe(6)
      })

      it('should parse tag 4 with positive exponent', () => {
        const { parseTag } = useCborTag()

        // 4([2, 5]) = 500
        const result = parseTag('c4820205')
        expect(result.value.tag).toBe(4)
        expect(result.value.value).toEqual([2, 5])
      })

      it('should parse tag 4 with zero exponent', () => {
        const { parseTag } = useCborTag()

        // 4([0, 123]) = 123
        const result = parseTag('c48200187b')
        expect(result.value.tag).toBe(4)
        expect(result.value.value).toEqual([0, 123])
      })
    })

    describe('Tag 5: Bigfloat [exponent, mantissa]', () => {
      it('should parse tag 5 with array [exponent, mantissa]', () => {
        const { parseTag } = useCborTag()

        // RFC 8949: 5([-2, 3]) = 3 * 2^-2 = 0.75
        const result = parseTag('c5822103')
        expect(result.value.tag).toBe(5)
        expect(result.value.value).toEqual([-2, 3])
        expect(result.bytesRead).toBe(4)
      })

      it('should parse tag 5 with large mantissa', () => {
        const { parseTag } = useCborTag()

        // 5([10, 1000000])
        const result = parseTag('c5820a1a000f4240')
        expect(result.value.tag).toBe(5)
        expect(result.value.value).toEqual([10, 1000000])
      })
    })
  })

  describe('Encoding Hint Tags (21-36)', () => {
    describe('Tag 21: Base64url Encoding Expected', () => {
      it('should parse tag 21 with byte string', () => {
        const { parseTag } = useCborTag()

        // 21(h'01020304')
        const result = parseTag('d54401020304')
        expect(result.value.tag).toBe(21)
        expect(result.value.value).toEqual(new Uint8Array([0x01, 0x02, 0x03, 0x04]))
      })
    })

    describe('Tag 22: Base64 Encoding Expected', () => {
      it('should parse tag 22 with byte string', () => {
        const { parseTag } = useCborTag()

        // 22(h'48656c6c6f')
        const result = parseTag('d64548656c6c6f')
        expect(result.value.tag).toBe(22)
        expect(result.value.value).toEqual(
          new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f])
        )
      })
    })

    describe('Tag 23: Base16 (Hex) Encoding Expected', () => {
      it('should parse tag 23 with byte string', () => {
        const { parseTag } = useCborTag()

        // 23(h'aabbccdd')
        const result = parseTag('d744aabbccdd')
        expect(result.value.tag).toBe(23)
        expect(result.value.value).toEqual(
          new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd])
        )
      })
    })

    describe('Tag 24: Embedded CBOR Data Item', () => {
      it('should parse tag 24 with byte string containing CBOR', () => {
        const { parseTag } = useCborTag()

        // 24(h'8301020 3') - byte string containing CBOR array [1,2,3]
        const result = parseTag('d8184483010203')
        expect(result.value.tag).toBe(24)
        expect(result.value.value).toEqual(new Uint8Array([0x83, 0x01, 0x02, 0x03]))
      })

      it('should parse tag 24 with nested CBOR map', () => {
        const { parseTag } = useCborTag()

        // 24(h'a16161 01') - CBOR map {"a": 1}
        const result = parseTag('d81844a1616101')
        expect(result.value.tag).toBe(24)
        expect(result.value.value).toEqual(new Uint8Array([0xa1, 0x61, 0x61, 0x01]))
      })
    })

    describe('Tag 32: URI', () => {
      it('should parse tag 32 with URI text string', () => {
        const { parseTag } = useCborTag()

        // 32("http://www.example.com")
        // 0xd8 0x20 = tag 32 (1-byte encoding)
        const result = parseTag('d82076687474703a2f2f7777772e6578616d706c652e636f6d')
        expect(result.value.tag).toBe(32)
        expect(result.value.value).toBe('http://www.example.com')
      })

      it('should parse tag 32 with HTTPS URI', () => {
        const { parseTag } = useCborTag()

        // 32("https://github.com")
        const result = parseTag('d82072687474707 33a2f2f6769746875622e636f6d'.replace(/\s/g, ''))
        expect(result.value.tag).toBe(32)
        expect(result.value.value).toBe('https://github.com')
      })
    })

    describe('Tag 33: Base64url (text string)', () => {
      it('should parse tag 33 with base64url text', () => {
        const { parseTag } = useCborTag()

        // 33("SGVsbG8")
        const result = parseTag('d82167534756736247 38'.replace(/\s/g, ''))
        expect(result.value.tag).toBe(33)
        expect(result.value.value).toBe('SGVsbG8')
      })
    })

    describe('Tag 34: Base64 (text string)', () => {
      it('should parse tag 34 with base64 text', () => {
        const { parseTag } = useCborTag()

        // 34("SGVsbG8=")
        const result = parseTag('d82268534756736247383d')
        expect(result.value.tag).toBe(34)
        expect(result.value.value).toBe('SGVsbG8=')
      })
    })

    describe('Tag 36: MIME Message', () => {
      it('should parse tag 36 with MIME content', () => {
        const { parseTag } = useCborTag()

        // 36("Content-Type: text/plain")
        const result = parseTag('d8247818436f6e74656e742d547970653a20746578742f706c61696e')
        expect(result.value.tag).toBe(36)
        expect(result.value.value).toBe('Content-Type: text/plain')
      })
    })
  })

  describe('Self-Describe CBOR Tag', () => {
    describe('Tag 55799: Self-Describe CBOR', () => {
      it('should parse tag 55799 with magic number', () => {
        const { parseTag } = useCborTag()

        // RFC 8949: 55799([1, 2])
        // 0xd9d9f7 = tag 55799 (2-byte encoding: 0xd9 + 0xd9f7)
        const result = parseTag('d9d9f7820102')
        expect(result.value.tag).toBe(55799)
        expect(result.value.value).toEqual([1, 2])
        expect(result.bytesRead).toBe(6)
      })

      it('should parse tag 55799 with complex nested structure', () => {
        const { parseTag } = useCborTag()

        // 55799({"msg": "Hello"})
        const result = parseTag('d9d9f7a1636d73676548656c6c6f')
        expect(result.value.tag).toBe(55799)
        expect(result.value.value).toEqual(new Map([['msg', 'Hello']]))
      })

      it('should parse tag 55799 wrapping simple integer', () => {
        const { parseTag } = useCborTag()

        // 55799(42)
        const result = parseTag('d9d9f7182a')
        expect(result.value.tag).toBe(55799)
        expect(result.value.value).toBe(42)
      })
    })
  })

  describe('Cardano-Specific Tags', () => {
    describe('Tag 121: Cardano Transaction (placeholder)', () => {
      it('should parse tag 121 with transaction array', () => {
        const { parseTag } = useCborTag()

        // 121([txBody, witnessSet, metadata])
        // Simplified: 121([1, 2, 3])
        const result = parseTag('d87983010203')
        expect(result.value.tag).toBe(121)
        expect(result.value.value).toEqual([1, 2, 3])
      })
    })

    describe('Tag 122: Cardano Witness Set (placeholder)', () => {
      it('should parse tag 122 with witness map', () => {
        const { parseTag } = useCborTag()

        // 122({"vkeys": []})
        // Simplified: 122({})
        const result = parseTag('d87aa0')
        expect(result.value.tag).toBe(122)
        expect(result.value.value).toEqual(new Map())
      })
    })

    describe('Tag 258: Mathematical Set', () => {
      it('should parse tag 258 with array as set', () => {
        const { parseTag } = useCborTag()

        // RFC 8949: 258([1, 2, 3]) - represents set {1, 2, 3}
        // 0xd90102 = tag 258 (2-byte encoding: 0xd9 + 0x0102)
        const result = parseTag('d9010283010203')
        expect(result.value.tag).toBe(258)
        expect(result.value.value).toEqual([1, 2, 3])
      })

      it('should parse tag 258 with empty set', () => {
        const { parseTag } = useCborTag()

        // 258([]) - empty set
        const result = parseTag('d9010280')
        expect(result.value.tag).toBe(258)
        expect(result.value.value).toEqual([])
      })

      it('should parse tag 258 with string set', () => {
        const { parseTag } = useCborTag()

        // 258(["a", "b", "c"])
        const result = parseTag('d9010283616161626163')
        expect(result.value.tag).toBe(258)
        expect(result.value.value).toEqual(['a', 'b', 'c'])
      })
    })
  })

  describe('Nested Tags', () => {
    it('should parse tag inside tag (double tagging)', () => {
      const { parseTag } = useCborTag()

      // 0(1(1363896240)) - date as both tag 0 and tag 1
      const result = parseTag('c0c11a514b67b0')
      expect(result.value.tag).toBe(0)
      expect(result.value.value).toEqual({
        tag: 1,
        value: 1363896240
      })
    })

    it('should parse triple nested tags', () => {
      const { parseTag } = useCborTag()

      // 258(21(24(h'83010203')))
      // Set containing base64url containing embedded CBOR
      const result = parseTag('d90102d5d8184483010203')
      expect(result.value.tag).toBe(258)
      expect(result.value.value.tag).toBe(21)
      expect(result.value.value.value.tag).toBe(24)
    })

    it('should parse tag wrapping array of tagged values', () => {
      const { parseTag } = useCborTag()

      // 258([1(100), 1(200)]) - set of two epoch times
      const result = parseTag('d9010282c11864c118c8')
      expect(result.value.tag).toBe(258)
      expect(result.value.value).toHaveLength(2)
      expect(result.value.value[0]).toEqual({ tag: 1, value: 100 })
      expect(result.value.value[1]).toEqual({ tag: 1, value: 200 })
    })

    it('should parse tag wrapping map with tagged values', () => {
      const { parseTag } = useCborTag()

      // 258({"time": 1(1000)})
      const result = parseTag('d90102a16474696d65c11903e8')
      expect(result.value.tag).toBe(258)
      expect(result.value.value).toEqual(new Map([
        ['time', { tag: 1, value: 1000 }]
      ]))
    })
  })

  describe('Extended Tag Numbers (1-byte, 2-byte, 4-byte, 8-byte)', () => {
    describe('Direct encoding (tags 0-23)', () => {
      it('should parse tag 0 with direct encoding', () => {
        const { parseTag } = useCborTag()

        // Tag 0: 0xc0
        const result = parseTag('c06474657374')
        expect(result.value.tag).toBe(0)
        expect(result.value.value).toBe('test')
      })

      it('should parse tag 23 with direct encoding', () => {
        const { parseTag } = useCborTag()

        // Tag 23: 0xd7
        const result = parseTag('d74401020304')
        expect(result.value.tag).toBe(23)
      })
    })

    describe('1-byte encoding (tags 24-255)', () => {
      it('should parse tag 24 with 1-byte encoding', () => {
        const { parseTag } = useCborTag()

        // Tag 24: 0xd8 0x18
        const result = parseTag('d8184401020304')
        expect(result.value.tag).toBe(24)
        expect(result.value.value).toEqual(new Uint8Array([0x01, 0x02, 0x03, 0x04]))
      })

      it('should parse tag 32 with 1-byte encoding', () => {
        const { parseTag } = useCborTag()

        // Tag 32: 0xd8 0x20
        const result = parseTag('d8206474657374')
        expect(result.value.tag).toBe(32)
        expect(result.value.value).toBe('test')
      })

      it('should parse tag 255 with 1-byte encoding', () => {
        const { parseTag } = useCborTag()

        // Tag 255: 0xd8 0xff
        const result = parseTag('d8ff00')
        expect(result.value.tag).toBe(255)
        expect(result.value.value).toBe(0)
      })
    })

    describe('2-byte encoding (tags 256-65535)', () => {
      it('should parse tag 256 with 2-byte encoding', () => {
        const { parseTag } = useCborTag()

        // Tag 256: 0xd9 0x0100
        const result = parseTag('d9010000')
        expect(result.value.tag).toBe(256)
        expect(result.value.value).toBe(0)
      })

      it('should parse tag 258 (set) with 2-byte encoding', () => {
        const { parseTag } = useCborTag()

        // Tag 258: 0xd9 0x0102
        const result = parseTag('d9010280')
        expect(result.value.tag).toBe(258)
      })

      it('should parse tag 55799 (self-describe) with 2-byte encoding', () => {
        const { parseTag } = useCborTag()

        // Tag 55799: 0xd9 0xd9f7
        const result = parseTag('d9d9f700')
        expect(result.value.tag).toBe(55799)
        expect(result.value.value).toBe(0)
      })

      it('should parse tag 65535 with 2-byte encoding', () => {
        const { parseTag } = useCborTag()

        // Tag 65535: 0xd9 0xffff
        const result = parseTag('d9ffff00')
        expect(result.value.tag).toBe(65535)
        expect(result.value.value).toBe(0)
      })
    })

    describe('4-byte encoding (tags 65536+)', () => {
      it('should parse tag 65536 with 4-byte encoding', () => {
        const { parseTag } = useCborTag()

        // Tag 65536: 0xda 0x00010000
        const result = parseTag('da0001000000')
        expect(result.value.tag).toBe(65536)
        expect(result.value.value).toBe(0)
      })

      it('should parse tag 1000000 with 4-byte encoding', () => {
        const { parseTag } = useCborTag()

        // Tag 1000000: 0xda 0x000f4240
        const result = parseTag('da000f424000')
        expect(result.value.tag).toBe(1000000)
        expect(result.value.value).toBe(0)
      })

      it('should parse tag 4294967295 (max 4-byte) with 4-byte encoding', () => {
        const { parseTag } = useCborTag()

        // Tag 2^32-1: 0xda 0xffffffff
        const result = parseTag('daffffffff00')
        expect(result.value.tag).toBe(4294967295)
        expect(result.value.value).toBe(0)
      })
    })

    describe('8-byte encoding (tags 4294967296+)', () => {
      it('should parse tag with 8-byte encoding', () => {
        const { parseTag } = useCborTag()

        // Tag 4294967296 (2^32): 0xdb 0x0000000100000000
        const result = parseTag('db000000010000000000')
        expect(result.value.tag).toBe(4294967296)
        expect(result.value.value).toBe(0)
      })

      it('should parse very large tag number with 8-byte encoding', () => {
        const { parseTag } = useCborTag()

        // Tag 1000000000000: 0xdb 0x000000e8d4a51000
        const result = parseTag('db000000e8d4a5100000')
        expect(result.value.tag).toBe(1000000000000)
        expect(result.value.value).toBe(0)
      })
    })
  })

  describe('Error Handling', () => {
    it('should throw error for invalid major type in parseTag', () => {
      const { parseTag } = useCborTag()

      // 0x00 = integer 0, not tag
      expect(() => parseTag('00')).toThrow('Expected major type 6 (tag)')
    })

    it('should throw error for truncated tag data', () => {
      const { parseTag } = useCborTag()

      // 0xc0 = tag 0, but no following data
      expect(() => parseTag('c0')).toThrow()
    })

    it('should throw error for truncated 1-byte tag number', () => {
      const { parseTag } = useCborTag()

      // 0xd8 = 1-byte tag, but no tag number
      expect(() => parseTag('d8')).toThrow()
    })

    it('should throw error for truncated 2-byte tag number', () => {
      const { parseTag } = useCborTag()

      // 0xd9 = 2-byte tag, incomplete tag number
      expect(() => parseTag('d901')).toThrow()
    })

    it('should throw error for truncated 4-byte tag number', () => {
      const { parseTag } = useCborTag()

      // 0xda = 4-byte tag, incomplete tag number
      expect(() => parseTag('da0001')).toThrow()
    })

    it('should throw error for truncated 8-byte tag number', () => {
      const { parseTag } = useCborTag()

      // 0xdb = 8-byte tag, incomplete tag number
      expect(() => parseTag('db00000001')).toThrow()
    })

    it('should throw error for reserved additional info', () => {
      const { parseTag } = useCborTag()

      // 0xdc = MT 6, AI 28 (reserved)
      expect(() => parseTag('dc')).toThrow('Reserved additional info')
    })

    it('should throw error for tag with missing value', () => {
      const { parseTag } = useCborTag()

      // Tag 0 with truncated string
      expect(() => parseTag('c06474')).toThrow()
    })
  })

  describe('Auto-detect parse function', () => {
    it('should auto-detect and parse tag 0', () => {
      const { parse } = useCborTag()

      const result = parse('c074323031332d30332d3231543230 3a30343a30305a')
      expect(result.value.tag).toBe(0)
      expect(result.value.value).toBe('2013-03-21T20:04:00Z')
    })

    it('should auto-detect and parse tag 258', () => {
      const { parse } = useCborTag()

      const result = parse('d9010283010203')
      expect(result.value.tag).toBe(258)
      expect(result.value.value).toEqual([1, 2, 3])
    })

    it('should auto-detect and parse nested tags', () => {
      const { parse } = useCborTag()

      const result = parse('c0c11a514b67b0')
      expect(result.value.tag).toBe(0)
      expect(result.value.value.tag).toBe(1)
    })
  })

  describe('RFC 8949 Examples', () => {
    it('should parse RFC example: 0("2013-03-21T20:04:00Z")', () => {
      const { parse } = useCborTag()

      const result = parse('c074323031332d30332d3231543230 3a30343a30305a')
      expect(result.value.tag).toBe(0)
      expect(result.value.value).toBe('2013-03-21T20:04:00Z')
    })

    it('should parse RFC example: 1(1363896240)', () => {
      const { parse } = useCborTag()

      const result = parse('c11a514b67b0')
      expect(result.value.tag).toBe(1)
      expect(result.value.value).toBe(1363896240)
    })

    it('should parse RFC example: 55799(h\'\')', () => {
      const { parse } = useCborTag()

      const result = parse('d9d9f740')
      expect(result.value.tag).toBe(55799)
      expect(result.value.value).toEqual(new Uint8Array([]))
    })
  })
})
