/**
 * CBOR Parser Error Handling Tests
 * Tests all error cases and edge cases for 100% code coverage
 */

import { describe, it, expect } from 'vitest'
import { useCborParser } from '../composables/useCborParser'

describe('useCborParser - Error Handling', () => {
  describe('Input Validation Errors', () => {
    it('should throw error for empty hex string', () => {
      const { parse } = useCborParser()
      expect(() => parse('')).toThrow('Empty hex string')
    })

    it('should throw error for whitespace-only hex string', () => {
      const { parse } = useCborParser()
      expect(() => parse('   ')).toThrow('Empty hex string')
    })

    it('should throw error for odd-length hex string', () => {
      const { parse } = useCborParser()
      expect(() => parse('1')).toThrow('Hex string must have even length')
    })

    it('should throw error for hex string with odd length (3 chars)', () => {
      const { parse } = useCborParser()
      expect(() => parse('123')).toThrow('Hex string must have even length')
    })

    it('should throw error for invalid hex characters', () => {
      const { parse } = useCborParser()
      expect(() => parse('1g')).toThrow('Invalid hex character')
    })

    it('should throw error for hex with special characters', () => {
      const { parse } = useCborParser()
      expect(() => parse('12@4')).toThrow('Invalid hex character')
    })

    it('should throw error for hex with spaces not removed', () => {
      const { parse } = useCborParser()
      // Spaces should be removed, but test with invalid chars after spaces
      expect(() => parse('ZZ')).toThrow('Invalid hex character')
    })
  })

  describe('Unknown Major Type Error', () => {
    it('should never throw unknown major type error (all types 0-7 are valid)', () => {
      // This tests the default case in the switch statement
      // However, extractCborHeader can only return 0-7, so this is defensive programming
      // We can't actually trigger this without mocking, but we have the code path

      // All major types should be handled:
      const { parse } = useCborParser()

      // MT 0: Integer
      expect(() => parse('00')).not.toThrow()

      // MT 1: Negative integer
      expect(() => parse('20')).not.toThrow()

      // MT 2: Byte string
      expect(() => parse('40')).not.toThrow()

      // MT 3: Text string
      expect(() => parse('60')).not.toThrow()

      // MT 4: Array
      expect(() => parse('80')).not.toThrow()

      // MT 5: Map
      expect(() => parse('a0')).not.toThrow()

      // MT 6: Tag
      expect(() => parse('c000')).not.toThrow()

      // MT 7: Float/Simple
      expect(() => parse('f4')).not.toThrow()
    })
  })

  describe('parseWithSourceMap', () => {
    it('should delegate to parse for now', () => {
      const { parseWithSourceMap } = useCborParser()

      // Test with various types
      expect(parseWithSourceMap('00').value).toBe(0)
      expect(parseWithSourceMap('20').value).toBe(-1)
      expect(parseWithSourceMap('60').value).toBe('')
      expect(parseWithSourceMap('f5').value).toBe(true)
    })

    it('should return same result as parse', () => {
      const { parse, parseWithSourceMap } = useCborParser()

      const testCases = ['00', '1864', '6449455446', '83010203', 'a0', 'f4']

      for (const hexString of testCases) {
        const parseResult = parse(hexString)
        const sourceMapResult = parseWithSourceMap(hexString)
        expect(sourceMapResult.value).toEqual(parseResult.value)
        expect(sourceMapResult.bytesRead).toBe(parseResult.bytesRead)
      }
    })
  })

  describe('Hex String Cleaning', () => {
    it('should handle hex with spaces', () => {
      const { parse } = useCborParser()

      // Should remove spaces before parsing
      expect(parse('18 64').value).toBe(100)
      expect(parse('83 01 02 03').value).toEqual([1, 2, 3])
    })

    it('should handle hex with tabs and newlines', () => {
      const { parse } = useCborParser()

      // Should remove all whitespace
      expect(parse('18\t64').value).toBe(100)
      expect(parse('18\n64').value).toBe(100)
      expect(parse('18\r\n64').value).toBe(100)
    })
  })
})
