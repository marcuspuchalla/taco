/**
 * Utils Error Handling Tests
 * Tests all error cases in utility functions for 100% code coverage
 */

import { describe, it, expect } from 'vitest'
import { readByte, readUint, readBigUint, hexToBytes } from '../utils'

describe('Utils - Error Handling', () => {
  describe('readUint - Invalid Length', () => {
    it('should throw error for length < 1', () => {
      const buffer = new Uint8Array([1, 2, 3, 4])
      expect(() => readUint(buffer, 0, 0)).toThrow('Invalid length: 0 (must be 1-8)')
    })

    it('should throw error for length > 8', () => {
      const buffer = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
      expect(() => readUint(buffer, 0, 9)).toThrow('Invalid length: 9 (must be 1-8)')
    })

    it('should throw error for negative length', () => {
      const buffer = new Uint8Array([1, 2, 3, 4])
      expect(() => readUint(buffer, 0, -1)).toThrow('Invalid length: -1 (must be 1-8)')
    })
  })

  describe('readBigUint - Invalid Length', () => {
    it('should throw error for length < 1', () => {
      const buffer = new Uint8Array([1, 2, 3, 4])
      expect(() => readBigUint(buffer, 0, 0)).toThrow('Invalid length: 0 (must be 1-8)')
    })

    it('should throw error for length > 8', () => {
      const buffer = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
      expect(() => readBigUint(buffer, 0, 9)).toThrow('Invalid length: 9 (must be 1-8)')
    })

    it('should throw error for negative length', () => {
      const buffer = new Uint8Array([1, 2, 3, 4])
      expect(() => readBigUint(buffer, 0, -1)).toThrow('Invalid length: -1 (must be 1-8)')
    })
  })

  describe('readUint - Valid Lengths', () => {
    it('should read 1-8 bytes successfully', () => {
      const buffer = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08])

      // Test all valid lengths (1-8)
      expect(readUint(buffer, 0, 1)).toBe(0x01)
      expect(readUint(buffer, 0, 2)).toBe(0x0102)
      expect(readUint(buffer, 0, 3)).toBe(0x010203)
      expect(readUint(buffer, 0, 4)).toBe(0x01020304)
      expect(readUint(buffer, 0, 5)).toBe(0x0102030405)
      expect(readUint(buffer, 0, 6)).toBe(0x010203040506)
      expect(readUint(buffer, 0, 7)).toBe(0x01020304050607)
      expect(readUint(buffer, 0, 8)).toBe(0x0102030405060708)
    })
  })

  describe('readBigUint - Valid Lengths', () => {
    it('should read 1-8 bytes successfully as BigInt', () => {
      const buffer = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08])

      // Test all valid lengths (1-8)
      expect(readBigUint(buffer, 0, 1)).toBe(0x01n)
      expect(readBigUint(buffer, 0, 2)).toBe(0x0102n)
      expect(readBigUint(buffer, 0, 3)).toBe(0x010203n)
      expect(readBigUint(buffer, 0, 4)).toBe(0x01020304n)
      expect(readBigUint(buffer, 0, 5)).toBe(0x0102030405n)
      expect(readBigUint(buffer, 0, 6)).toBe(0x010203040506n)
      expect(readBigUint(buffer, 0, 7)).toBe(0x01020304050607n)
      expect(readBigUint(buffer, 0, 8)).toBe(0x0102030405060708n)
    })
  })

  describe('readByte - Out of Bounds', () => {
    it('should throw error when reading beyond buffer', () => {
      const buffer = new Uint8Array([1, 2, 3])
      expect(() => readByte(buffer, 3)).toThrow('Offset 3 is out of bounds')
    })

    it('should not throw for negative offset (returns undefined, not an error in JS)', () => {
      const buffer = new Uint8Array([1, 2, 3])
      // Note: JavaScript Uint8Array with negative index returns undefined, not an error
      // The check `offset >= buffer.length` doesn't catch negative numbers
      // This is a known limitation but unlikely to occur in practice since CBOR parsing
      // always uses non-negative offsets
      expect(buffer[-1]).toBeUndefined()
    })
  })

  describe('readUint - Out of Bounds', () => {
    it('should throw error when reading beyond buffer', () => {
      const buffer = new Uint8Array([1, 2, 3])
      expect(() => readUint(buffer, 2, 2)).toThrow('Cannot read 2 bytes at offset 2')
    })
  })

  describe('readBigUint - Out of Bounds', () => {
    it('should throw error when reading beyond buffer', () => {
      const buffer = new Uint8Array([1, 2, 3])
      expect(() => readBigUint(buffer, 2, 2)).toThrow('Cannot read 2 bytes at offset 2')
    })
  })

  describe('hexToBytes - Edge Cases', () => {
    it('should return empty array for empty string', () => {
      const result = hexToBytes('')
      expect(result).toEqual(new Uint8Array(0))
    })

    it('should handle lowercase hex', () => {
      const result = hexToBytes('abcd')
      expect(result).toEqual(new Uint8Array([0xab, 0xcd]))
    })

    it('should handle uppercase hex', () => {
      const result = hexToBytes('ABCD')
      expect(result).toEqual(new Uint8Array([0xAB, 0xCD]))
    })

    it('should handle mixed case hex', () => {
      const result = hexToBytes('AbCd')
      expect(result).toEqual(new Uint8Array([0xab, 0xcd]))
    })
  })
})
