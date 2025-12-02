/**
 * CBOR Sequences Tests (RFC 8742)
 * TDD: Tests written BEFORE implementation
 *
 * A CBOR Sequence is a concatenation of zero or more CBOR data items.
 * Unlike a CBOR array, sequences have no length prefix.
 */

import { describe, it, expect } from 'vitest'
import { useCborParser } from '../composables/useCborParser'

describe('CBOR Sequences (RFC 8742)', () => {
  const { parse, parseSequence } = useCborParser()

  describe('parseSequence', () => {
    it('should parse empty sequence', () => {
      const hex = ''
      const result = parseSequence(hex)

      expect(result).toEqual([])
    })

    it('should parse single item sequence', () => {
      const hex = '01' // integer 1
      const result = parseSequence(hex)

      expect(result).toEqual([1])
    })

    it('should parse sequence of integers', () => {
      // 01 02 03 = three separate integers
      const hex = '010203'
      const result = parseSequence(hex)

      expect(result).toEqual([1, 2, 3])
    })

    it('should parse sequence of mixed types', () => {
      // 01 (int 1) + 6568656c6c6f (text "hello") + f5 (true)
      const hex = '016568656c6c6ff5'
      const result = parseSequence(hex)

      expect(result).toHaveLength(3)
      expect(result[0]).toBe(1)
      expect(result[1]).toBe('hello')
      expect(result[2]).toBe(true)
    })

    it('should parse sequence with arrays', () => {
      // 83010203 (array [1,2,3]) + 82040 5 (array [4,5])
      const hex = '8301020382 0405'.replace(/\s/g, '')
      const result = parseSequence(hex)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual([1, 2, 3])
      expect(result[1]).toEqual([4, 5])
    })

    it('should parse sequence with maps', () => {
      // a1616101 ({"a": 1}) + a1616202 ({"b": 2})
      const hex = 'a1616101a1616202'
      const result = parseSequence(hex)

      expect(result).toHaveLength(2)
    })

    it('should parse sequence with tagged values', () => {
      // c11a514b67b0 (tag 1, epoch) + c11a514b67b1 (tag 1, epoch+1)
      const hex = 'c11a514b67b0c11a514b67b1'
      const result = parseSequence(hex)

      expect(result).toHaveLength(2)
      expect((result[0] as any).tag).toBe(1)
      expect((result[1] as any).tag).toBe(1)
    })

    it('should handle indefinite-length items in sequence', () => {
      // 9f010203ff (indefinite array [1,2,3]) + 05 (int 5)
      const hex = '9f010203ff05'
      const result = parseSequence(hex)

      expect(result).toHaveLength(2)
      expect([...(result[0] as any)]).toEqual([1, 2, 3])
      expect(result[1]).toBe(5)
    })

    it('should throw on malformed sequence item', () => {
      // 83 01 02 (incomplete array - needs 3 items)
      const hex = '830102'

      expect(() => parseSequence(hex)).toThrow()
    })

    it('should respect options for all items', () => {
      // Two non-canonical integers
      const hex = '18001801' // 0 encoded as 2 bytes, 1 encoded as 2 bytes

      expect(() => parseSequence(hex, { validateCanonical: true }))
        .toThrow(/non-canonical/i)
    })
  })

  describe('parseSequenceWithSourceMap', () => {
    it('should return source maps for each item', () => {
      const hex = '010203'
      const { parseSequenceWithSourceMap } = useCborParser()
      const result = parseSequenceWithSourceMap(hex)

      expect(result.values).toEqual([1, 2, 3])
      expect(result.sourceMaps).toHaveLength(3)

      // Each item should have its own source map
      expect(result.sourceMaps[0][0].start).toBe(0)
      expect(result.sourceMaps[0][0].end).toBe(1)

      expect(result.sourceMaps[1][0].start).toBe(1)
      expect(result.sourceMaps[1][0].end).toBe(2)

      expect(result.sourceMaps[2][0].start).toBe(2)
      expect(result.sourceMaps[2][0].end).toBe(3)
    })
  })

  describe('Edge cases', () => {
    it('should handle sequence with only break code (invalid)', () => {
      const hex = 'ff' // break code outside indefinite context

      expect(() => parseSequence(hex)).toThrow()
    })

    it('should handle large sequence', () => {
      // 100 integers: 00 01 02 ... 63 (0-99 in hex)
      let hex = ''
      for (let i = 0; i < 100; i++) {
        if (i < 24) {
          hex += i.toString(16).padStart(2, '0')
        } else {
          hex += '18' + i.toString(16).padStart(2, '0')
        }
      }

      const result = parseSequence(hex)
      expect(result).toHaveLength(100)
      expect(result[0]).toBe(0)
      expect(result[23]).toBe(23)
      expect(result[24]).toBe(24)
      expect(result[99]).toBe(99)
    })
  })
})
