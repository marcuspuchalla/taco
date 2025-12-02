/**
 * CBOR Denial of Service (DoS) Protection Tests
 *
 * Tests for critical security vulnerabilities:
 * - CVE-2020-28491: Bignum memory exhaustion
 * - RUSTSEC-2019-0025: Tag nesting stack overflow
 * - Indefinite-length break code validation
 * - Float canonical encoding
 *
 * These tests verify protections against known CBOR implementation vulnerabilities.
 */

import { describe, it, expect } from 'vitest'
import { useCborTag } from '../composables/useCborTag'
import { useCborParser } from '../composables/useCborParser'
import { useCborCollection } from '../composables/useCborCollection'

describe('CVE-2020-28491: Bignum Memory Exhaustion Protection', () => {
  describe('Tag 2: Positive Bignum Size Limits', () => {
    it('should accept tag 2 bignum within size limit', () => {
      const { parseTag } = useCborTag()

      // Tag 2 with 512-byte bignum (within 1KB default limit)
      const bignumBytes = '00'.repeat(512)
      const bignum = `c2590200${bignumBytes}` // c2 = tag 2, 590200 = byte string of 512 bytes

      const result = parseTag(bignum, { limits: { maxBignumBytes: 1024 } })

      expect(result.value.tag).toBe(2)
      expect(typeof result.value.value).toBe('bigint')
      // 512 bytes of 0x00 = BigInt 0
      expect(result.value.value).toBe(0n)
    })

    it('should reject tag 2 bignum exceeding size limit', () => {
      const { parseTag } = useCborTag()

      // Tag 2 with 2KB bignum (exceeds 1KB limit)
      const bignumBytes = '00'.repeat(2048)
      const bignum = `c2590800${bignumBytes}` // 2048 bytes

      expect(() => parseTag(bignum, { limits: { maxBignumBytes: 1024 } }))
        .toThrow(/bignum.*exceeds.*1024 bytes/i)
    })

    it('should reject tag 2 with massive bignum (memory DoS)', () => {
      const { parseTag } = useCborTag()

      // Tag 2 with 2048-byte bignum (exceeds 1024 byte limit)
      // c2 = tag 2, 590800 = byte string of 2048 bytes
      const bignumBytes = '00'.repeat(2048)
      const bignum = `c2590800${bignumBytes}`

      expect(() => parseTag(bignum, { limits: { maxBignumBytes: 1024 } }))
        .toThrow(/bignum.*exceeds.*1024 bytes/i)
    })

    it('should accept tag 2 with exactly max size', () => {
      const { parseTag } = useCborTag()

      // Exactly 1024 bytes (at limit)
      const bignumBytes = 'ff'.repeat(1024)
      const bignum = `c2590400${bignumBytes}`

      const result = parseTag(bignum, { limits: { maxBignumBytes: 1024 } })

      expect(result.value.tag).toBe(2)
      expect(typeof result.value.value).toBe('bigint')
      // 1024 bytes of 0xff should be a large positive bigint
      // 2^(1024*8) - 1
      expect(result.value.value > 0n).toBe(true)
    })

    it('should reject tag 2 with 1 byte over limit', () => {
      const { parseTag } = useCborTag()

      // 1025 bytes (1 over limit)
      const bignumBytes = 'ff'.repeat(1025)
      const bignum = `c2590401${bignumBytes}`

      expect(() => parseTag(bignum, { limits: { maxBignumBytes: 1024 } }))
        .toThrow(/bignum.*exceeds.*1024 bytes/i)
    })

    it('should use default bignum limit when not specified', () => {
      const { parseTag } = useCborTag()

      // 2KB bignum with no limit specified (should use default 1KB)
      const bignumBytes = 'aa'.repeat(2048)
      const bignum = `c2590800${bignumBytes}`

      expect(() => parseTag(bignum)) // No options = use defaults
        .toThrow(/bignum.*exceeds/i)
    })

    it('should allow custom bignum limits', () => {
      const { parseTag } = useCborTag()

      // 2KB bignum with 4KB limit (should pass)
      const bignumBytes = 'bb'.repeat(2048)
      const bignum = `c2590800${bignumBytes}`

      const result = parseTag(bignum, { limits: { maxBignumBytes: 4096 } })

      expect(result.value.tag).toBe(2)
      expect(typeof result.value.value).toBe('bigint')
      // 2048 bytes of 0xbb should be a large positive bigint
      expect(result.value.value > 0n).toBe(true)
    })

    it('should accept empty bignum (edge case)', () => {
      const { parseTag } = useCborTag()

      // Tag 2 with empty byte string (0 bytes)
      const bignum = 'c240' // c2 = tag 2, 40 = empty byte string

      const result = parseTag(bignum, { limits: { maxBignumBytes: 1024 } })

      expect(result.value.tag).toBe(2)
      expect(typeof result.value.value).toBe('bigint')
      // Empty byte string = BigInt 0
      expect(result.value.value).toBe(0n)
    })
  })

  describe('Tag 3: Negative Bignum Size Limits', () => {
    it('should accept tag 3 bignum within size limit', () => {
      const { parseTag } = useCborTag()

      // Tag 3 with 256-byte bignum
      const bignumBytes = 'ff'.repeat(256)
      const bignum = `c3590100${bignumBytes}` // c3 = tag 3, 590100 = 256 bytes

      const result = parseTag(bignum, { limits: { maxBignumBytes: 1024 } })

      expect(result.value.tag).toBe(3)
      expect(typeof result.value.value).toBe('bigint')
      // Tag 3 = -1 - n, where n is the bignum value
      // 256 bytes of 0xff should be a large negative bigint
      expect(result.value.value < 0n).toBe(true)
    })

    it('should reject tag 3 bignum exceeding size limit', () => {
      const { parseTag } = useCborTag()

      // Tag 3 with 4KB bignum (exceeds 1KB limit)
      const bignumBytes = 'ff'.repeat(4096)
      const bignum = `c3591000${bignumBytes}` // 4096 bytes

      expect(() => parseTag(bignum, { limits: { maxBignumBytes: 1024 } }))
        .toThrow(/bignum.*exceeds.*1024 bytes/i)
    })

    it('should handle both tag 2 and tag 3 with same limit', () => {
      const { parseTag } = useCborTag()

      const limit = { maxBignumBytes: 512 }

      // Tag 2 with 512 bytes (OK)
      const bignum2 = `c2590200${'aa'.repeat(512)}`
      expect(() => parseTag(bignum2, { limits: limit })).not.toThrow()

      // Tag 3 with 512 bytes (OK)
      const bignum3 = `c3590200${'bb'.repeat(512)}`
      expect(() => parseTag(bignum3, { limits: limit })).not.toThrow()

      // Tag 2 with 513 bytes (FAIL)
      const bignum2Fail = `c2590201${'cc'.repeat(513)}`
      expect(() => parseTag(bignum2Fail, { limits: limit })).toThrow()

      // Tag 3 with 513 bytes (FAIL)
      const bignum3Fail = `c3590201${'dd'.repeat(513)}`
      expect(() => parseTag(bignum3Fail, { limits: limit })).toThrow()
    })
  })

  describe('Other Tags (Non-Bignum) Should Not Be Limited', () => {
    it('should NOT apply bignum limit to tag 1 (epoch time)', () => {
      const { parseTag } = useCborTag()

      // Tag 1 with large integer (not a bignum)
      const epochTag = 'c11a514b67b0' // Tag 1 with 1363896240

      const result = parseTag(epochTag, { limits: { maxBignumBytes: 100 } })

      expect(result.value.tag).toBe(1)
      expect(result.value.value).toBe(1363896240)
    })

    it('should NOT apply bignum limit to tag 24 (embedded CBOR)', () => {
      const { parseTag } = useCborTag()

      // Tag 24 with byte string containing CBOR (not a bignum)
      const embeddedCBOR = 'd8184401020304' // Tag 24 with h'01020304'

      const result = parseTag(embeddedCBOR, { limits: { maxBignumBytes: 2 } })

      expect(result.value.tag).toBe(24)
      expect(result.value.value).toBeInstanceOf(Uint8Array)
    })

    it('should NOT apply bignum limit to tag 258 (set)', () => {
      const { parseTag } = useCborTag()

      // Tag 258 with array (not a bignum)
      const setTag = 'd9010283010203' // Tag 258 with [1, 2, 3]

      const result = parseTag(setTag, { limits: { maxBignumBytes: 2 } })

      expect(result.value.tag).toBe(258)
      expect(result.value.value).toBeInstanceOf(Array)
    })
  })
})

describe('RUSTSEC-2019-0025: Tag Nesting Stack Overflow Protection', () => {
  describe('Tag Nesting Depth Limits', () => {
    it('should accept tag nesting within depth limit', () => {
      const { parseTag } = useCborTag()

      // 10 nested tags (within 64 default limit)
      const nested = 'c0'.repeat(10) + '00' // Tag 0 nested 10 times

      const result = parseTag(nested, { limits: { maxTagDepth: 64 } })

      expect(result.value.tag).toBe(0)
      // Nested structure: tag 0 -> tag 0 -> ... -> 0
    })

    it('should reject tag nesting exceeding depth limit', () => {
      const { parseTag } = useCborTag()

      // 100 nested tags (exceeds 64 default limit)
      const nested = 'c0'.repeat(100) + '00'

      expect(() => parseTag(nested, { limits: { maxTagDepth: 64 } }))
        .toThrow(/tag nesting depth.*exceeds.*64/i)
    })

    it('should reject tag nesting at exactly limit + 1', () => {
      const { parseTag } = useCborTag()

      // 11 nested tags with limit of 10 (should fail at 11th)
      const nested = 'c0'.repeat(11) + '00'

      expect(() => parseTag(nested, { limits: { maxTagDepth: 10 } }))
        .toThrow(/tag nesting depth.*exceeds.*10/i)
    })

    it('should accept tag nesting at exactly the limit', () => {
      const { parseTag } = useCborTag()

      // 10 nested tags with limit of 10 (should pass)
      const nested = 'c0'.repeat(10) + '00'

      const result = parseTag(nested, { limits: { maxTagDepth: 10 } })

      expect(result.value.tag).toBe(0)
    })

    it('should use default tag depth limit when not specified', () => {
      const { parseTag } = useCborTag()

      // 100 nested tags (exceeds default 64)
      const nested = 'c0'.repeat(100) + '00'

      expect(() => parseTag(nested)) // No options = use defaults
        .toThrow(/tag nesting depth.*exceeds/i)
    })

    it('should allow custom tag depth limits', () => {
      const { parseTag } = useCborTag()

      // 100 nested tags with 150 limit (should pass)
      const nested = 'c0'.repeat(100) + '00'

      const result = parseTag(nested, { limits: { maxTagDepth: 150 } })

      expect(result.value.tag).toBe(0)
    })

    it('should handle nested tags with different tag numbers', () => {
      const { parseTag } = useCborTag()

      // Tag 1 -> Tag 2 -> Tag 3 -> 0
      const nested = 'c1c2c300' // Tag 1( Tag 2( Tag 3( 0 )))

      const result = parseTag(nested, { limits: { maxTagDepth: 5 } })

      expect(result.value.tag).toBe(1)
      expect(result.value.value.tag).toBe(2)
      expect((result.value.value as any).value).toHaveProperty('tag', 3)
    })

    it('should reject deeply nested mixed tags', () => {
      const { parseTag } = useCborTag()

      // Mix of tag numbers, deeply nested
      const nested = 'c0c1c2c3c0c1c2c3c0c1c2' + '00' // 11 tags

      expect(() => parseTag(nested, { limits: { maxTagDepth: 10 } }))
        .toThrow(/tag nesting depth.*exceeds/i)
    })

    it('should handle tag depth separate from collection depth', () => {
      const { parseTag } = useCborTag()

      // Tag 1 containing array (tag depth 1, collection depth 1)
      const tagWithArray = 'c183010203' // Tag 1([1, 2, 3])

      const result = parseTag(tagWithArray, {
        limits: { maxTagDepth: 5, maxDepth: 5 }
      })

      expect(result.value.tag).toBe(1)
      expect(result.value.value).toEqual([1, 2, 3])
    })

    it('should prevent stack overflow with minimal input (< 1KB)', () => {
      const { parseTag } = useCborTag()

      // RUSTSEC-2019-0025: Small input (< 1KB) that causes stack overflow
      // 200 nested tags = 400 bytes of input
      const nested = 'c0'.repeat(200) + '00'

      expect(() => parseTag(nested, { limits: { maxTagDepth: 64 } }))
        .toThrow(/tag nesting depth.*exceeds/i)

      // Verify input is indeed small
      expect(nested.length).toBeLessThan(1000)
    })
  })
})

describe('Indefinite-Length Break Code Validation', () => {
  describe('Indefinite-Length Arrays - Break Code Required', () => {
    it('should accept indefinite array with proper break code', () => {
      const { parseArray } = useCborCollection()

      // Indefinite array: [_ 1, 2, 3, BREAK]
      const indefinite = '9f010203ff' // 9f = indefinite array, ff = break

      const result = parseArray(indefinite, { allowIndefinite: true })

      expect(Array.isArray(result.value)).toBe(true)
      expect((result.value as any[])[0]).toBe(1)
      expect((result.value as any[])[1]).toBe(2)
      expect((result.value as any[])[2]).toBe(3)
    })

    it('should throw error for indefinite array without break code', () => {
      const { parseArray } = useCborCollection()

      // Indefinite array missing break: [_ 1, 2, 3 (NO FF)
      const noBreak = '9f010203' // Missing 0xff

      expect(() => parseArray(noBreak, { allowIndefinite: true }))
        .toThrow(/missing.*break/i)
    })

    it('should accept empty indefinite array with break', () => {
      const { parseArray } = useCborCollection()

      // Indefinite array: [_ BREAK]
      const emptyIndefinite = '9fff' // Just start + break

      const result = parseArray(emptyIndefinite, { allowIndefinite: true })

      expect(Array.isArray(result.value)).toBe(true)
      expect(result.value).toHaveLength(0)
    })

    it('should handle nested indefinite arrays with breaks', () => {
      const { parseArray } = useCborCollection()

      // [_ [_ 1 BREAK] BREAK]
      const nestedIndefinite = '9f9f01ffff'

      const result = parseArray(nestedIndefinite, { allowIndefinite: true })

      expect(Array.isArray(result.value)).toBe(true)
      expect(result.value).toHaveLength(1)
      expect(Array.isArray((result.value as any[])[0])).toBe(true)
      expect((result.value as any[])[0][0]).toBe(1)
    })
  })

  describe('Indefinite-Length Maps - Break Code Required', () => {
    it('should accept indefinite map with proper break code', () => {
      const { parseMap } = useCborCollection()

      // Indefinite map: {_ "a": 1, "b": 2, BREAK}
      const indefinite = 'bf616101616202ff' // bf = indefinite map, ff = break

      const result = parseMap(indefinite, { allowIndefinite: true })

      expect(result.value).toEqual(new Map([['a', 1], ['b', 2]]))
    })

    it('should throw error for indefinite map without break code', () => {
      const { parseMap } = useCborCollection()

      // Indefinite map missing break: {_ "a": 1 (NO FF)
      const noBreak = 'bf616101' // Missing 0xff

      expect(() => parseMap(noBreak, { allowIndefinite: true }))
        .toThrow(/missing.*break/i)
    })

    it('should accept empty indefinite map with break', () => {
      const { parseMap } = useCborCollection()

      // Indefinite map: {_ BREAK}
      const emptyIndefinite = 'bfff'

      const result = parseMap(emptyIndefinite, { allowIndefinite: true })

      expect(result.value).toEqual(new Map())
    })
  })

  describe('Indefinite-Length in Strict Mode', () => {
    it('should reject indefinite arrays in canonical/strict mode', () => {
      const { parseArray } = useCborCollection()

      const indefinite = '9f010203ff'

      expect(() => parseArray(indefinite, { validateCanonical: true }))
        .toThrow(/indefinite.*not allowed/i)
    })

    it('should reject indefinite maps in canonical/strict mode', () => {
      const { parseMap } = useCborCollection()

      const indefinite = 'bf616101ff'

      expect(() => parseMap(indefinite, { validateCanonical: true }))
        .toThrow(/indefinite.*not allowed/i)
    })

    it('should enforce strict mode disallows indefinite encoding', () => {
      const { parse } = useCborParser()

      const indefiniteArray = '9f0102ff'

      expect(() => parse(indefiniteArray, { strict: true }))
        .toThrow(/indefinite.*not allowed/i)
    })
  })
})

describe('Combined Security Protections', () => {
  it('should handle all limits simultaneously', () => {
    const { parse } = useCborParser()

    // Complex nested structure within all limits
    const complexCBOR = 'c1a2616183010203616282c240c300'
    // Tag 1( {"a": [1,2,3], "b": [Tag 2(h''), Tag 3(0)]} )

    const result = parse(complexCBOR, {
      limits: {
        maxDepth: 10,
        maxTagDepth: 5,
        maxBignumBytes: 1024,
        maxArrayLength: 100,
        maxMapSize: 100
      }
    })

    expect(result.value.tag).toBe(1)
  })

  it('should reject when any single limit is exceeded', () => {
    const { parseTag } = useCborTag()

    // Exceeds tag depth but not bignum size
    const deepTags = 'c0'.repeat(100) + '00'

    expect(() => parseTag(deepTags, {
      limits: {
        maxTagDepth: 10,
        maxBignumBytes: 10000 // Very permissive
      }
    })).toThrow(/tag nesting depth/i)
  })

  it('should use strict mode to enable all security validations', () => {
    const { parse } = useCborParser()

    // Non-canonical integer (wasteful encoding)
    expect(() => parse('180a', { strict: true }))
      .toThrow(/non-canonical/i)

    // Indefinite length
    expect(() => parse('9f01ff', { strict: true }))
      .toThrow(/indefinite.*not allowed/i)

    // Would reject duplicate keys if map had them
    const duplicateMap = 'a2616101616102'
    expect(() => parse(duplicateMap, { strict: true }))
      .toThrow(/duplicate/i)
  })
})
