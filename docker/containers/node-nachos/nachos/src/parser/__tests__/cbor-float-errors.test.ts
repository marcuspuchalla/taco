/**
 * CBOR Float Parser Error Handling Tests
 * Tests all error cases and edge cases for 100% code coverage
 */

import { describe, it, expect } from 'vitest'
import { useCborFloat } from '../composables/useCborFloat'

describe('useCborFloat - Error Handling', () => {
  describe('parseSimple - Wrong Major Type', () => {
    it('should throw error when major type is not 7', () => {
      const { parseSimple } = useCborFloat()

      // MT 0 (integer) should not be parsed as simple value
      expect(() => parseSimple('00')).toThrow('Expected major type 7 (simple/float), got 0')
    })

    it('should throw error for MT 2 (byte string)', () => {
      const { parseSimple } = useCborFloat()
      expect(() => parseSimple('40')).toThrow('Expected major type 7 (simple/float), got 2')
    })
  })

  describe('parseFloat - Wrong Major Type', () => {
    it('should throw error when major type is not 7', () => {
      const { parseFloat } = useCborFloat()

      // MT 0 (integer) should not be parsed as float
      expect(() => parseFloat('00')).toThrow('Expected major type 7 (simple/float), got 0')
    })

    it('should throw error for MT 3 (text string)', () => {
      const { parseFloat } = useCborFloat()
      expect(() => parseFloat('60')).toThrow('Expected major type 7 (simple/float), got 3')
    })
  })

  describe('Simple Value - Unexpected End of Buffer', () => {
    it('should throw error when 1-byte simple value has no data', () => {
      const { parseSimple } = useCborFloat()

      // MT 7, AI 24 (1-byte simple value) but no following byte
      expect(() => parseSimple('f8')).toThrow('Unexpected end of buffer while reading simple value')
    })
  })

  describe('Simple Value - Invalid 1-byte Encoding', () => {
    it('should throw error for 1-byte encoding of value < 32', () => {
      const { parseSimple } = useCborFloat()

      // AI 24 should not be used for values 0-31
      // MT 7, AI 24, value 10 (0x0a) - invalid encoding
      expect(() => parseSimple('f80a')).toThrow('Invalid 1-byte encoding for simple value 10')
    })

    it('should throw error for 1-byte encoding of value 20', () => {
      const { parseSimple } = useCborFloat()

      // Value 20 (false) should use direct encoding (f4), not 1-byte
      expect(() => parseSimple('f814')).toThrow('Invalid 1-byte encoding for simple value 20')
    })

    it('should allow 1-byte encoding for value >= 32', () => {
      const { parseSimple } = useCborFloat()

      // Valid: 1-byte encoding for value 32 or higher
      const result = parseSimple('f820') // Simple value 32
      expect(result.value).toEqual({ simpleValue: 32 })
    })
  })

  describe('Simple Value - Float Type Error', () => {
    it('should throw error when parseSimple is called on Float16', () => {
      const { parseSimple } = useCborFloat()

      // MT 7, AI 25 (Float16) should use parseFloat, not parseSimple
      expect(() => parseSimple('f90000')).toThrow('Additional info 25 is a float, use parseFloat instead')
    })

    it('should throw error when parseSimple is called on Float32', () => {
      const { parseSimple } = useCborFloat()

      // MT 7, AI 26 (Float32)
      expect(() => parseSimple('fa00000000')).toThrow('Additional info 26 is a float, use parseFloat instead')
    })

    it('should throw error when parseSimple is called on Float64', () => {
      const { parseSimple } = useCborFloat()

      // MT 7, AI 27 (Float64)
      expect(() => parseSimple('fb0000000000000000')).toThrow('Additional info 27 is a float, use parseFloat instead')
    })
  })

  describe('Simple Value - Reserved Additional Info', () => {
    it('should throw error for reserved AI 28', () => {
      const { parseSimple } = useCborFloat()

      // MT 7, AI 28 - reserved
      expect(() => parseSimple('fc')).toThrow('Reserved additional info value: 28')
    })

    it('should throw error for reserved AI 29', () => {
      const { parseSimple } = useCborFloat()

      // MT 7, AI 29 - reserved
      expect(() => parseSimple('fd')).toThrow('Reserved additional info value: 29')
    })

    it('should throw error for reserved AI 30', () => {
      const { parseSimple } = useCborFloat()

      // MT 7, AI 30 - reserved
      expect(() => parseSimple('fe')).toThrow('Reserved additional info value: 30')
    })
  })

  describe('Simple Value - Break Marker Error', () => {
    it('should throw error for break marker (0xff) outside indefinite context', () => {
      const { parseSimple } = useCborFloat()

      // MT 7, AI 31 (break marker) - only valid in indefinite-length items
      expect(() => parseSimple('ff')).toThrow('Break marker (0xff) should only appear in indefinite-length items')
    })
  })

  describe('parseFloat - Invalid Additional Info', () => {
    it('should throw error when parseFloat is called on simple value', () => {
      const { parseFloat } = useCborFloat()

      // MT 7, AI 20 (false) is not a float
      expect(() => parseFloat('f4')).toThrow('Additional info 20 is not a float type')
    })

    it('should throw error for AI 24 (1-byte simple)', () => {
      const { parseFloat } = useCborFloat()

      // AI 24 is for simple values, not floats
      expect(() => parseFloat('f8ff')).toThrow('Additional info 24 is not a float type')
    })
  })

  describe('Float - Unexpected End of Buffer', () => {
    it('should throw error when Float16 has insufficient data (0 bytes)', () => {
      const { parseFloat } = useCborFloat()

      // MT 7, AI 25 (Float16) needs 2 bytes, but has none
      expect(() => parseFloat('f9')).toThrow('Unexpected end of buffer while reading Float16')
    })

    it('should throw error when Float16 has insufficient data (1 byte)', () => {
      const { parseFloat } = useCborFloat()

      // MT 7, AI 25 (Float16) needs 2 bytes, but has only 1
      expect(() => parseFloat('f900')).toThrow('Unexpected end of buffer while reading Float16')
    })

    it('should throw error when Float32 has insufficient data', () => {
      const { parseFloat } = useCborFloat()

      // MT 7, AI 26 (Float32) needs 4 bytes, but has only 3
      expect(() => parseFloat('fa000000')).toThrow('Unexpected end of buffer while reading Float32')
    })

    it('should throw error when Float64 has insufficient data', () => {
      const { parseFloat } = useCborFloat()

      // MT 7, AI 27 (Float64) needs 8 bytes, but has only 7
      expect(() => parseFloat('fb00000000000000')).toThrow('Unexpected end of buffer while reading Float64')
    })
  })

  describe('Simple Value - All Unassigned Values', () => {
    it('should parse unassigned simple values 0-19', () => {
      const { parseSimple } = useCborFloat()

      // Test some unassigned values
      expect(parseSimple('f0').value).toEqual({ simpleValue: 16 }) // AI 16
      expect(parseSimple('f1').value).toEqual({ simpleValue: 17 }) // AI 17
      expect(parseSimple('f2').value).toEqual({ simpleValue: 18 }) // AI 18
      expect(parseSimple('f3').value).toEqual({ simpleValue: 19 }) // AI 19

      // 0-15 are also unassigned
      expect(parseSimple('e0').value).toEqual({ simpleValue: 0 })  // AI 0
      expect(parseSimple('e1').value).toEqual({ simpleValue: 1 })  // AI 1
    })
  })

  describe('parse() auto-detection', () => {
    it('should auto-detect and parse simple values', () => {
      const { parse } = useCborFloat()

      expect(parse('f4').value).toBe(false)
      expect(parse('f5').value).toBe(true)
      expect(parse('f6').value).toBe(null)
      expect(parse('f7').value).toBe(undefined)
    })

    it('should auto-detect and parse floats', () => {
      const { parse } = useCborFloat()

      expect(parse('f90000').value).toBe(0.0)
      expect(parse('fa47c35000').value).toBe(100000.0)
      expect(parse('fb3ff0000000000000').value).toBe(1.0)
    })

    it('should handle unassigned simple values via auto-detect', () => {
      const { parse } = useCborFloat()

      expect(parse('f0').value).toEqual({ simpleValue: 16 })
    })
  })

  describe('Wrong Major Type in parse()', () => {
    it('should throw error when auto-detecting with wrong major type', () => {
      const { parse } = useCborFloat()

      // MT 4 (array) is not MT 7
      expect(() => parse('80')).toThrow('Expected major type 7 (simple/float), got 4')
    })
  })
})
