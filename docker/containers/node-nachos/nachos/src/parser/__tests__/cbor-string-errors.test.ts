/**
 * CBOR String Parser Error Handling Tests
 * Tests all error cases and edge cases for 100% code coverage
 */

import { describe, it, expect } from 'vitest'
import { useCborString } from '../composables/useCborString'

describe('useCborString - Error Handling', () => {
  describe('parseLength - All Encoding Sizes', () => {
    it('should parse 4-byte length (AI 26)', () => {
      const { parseString } = useCborString()

      // MT 2, AI 26 (4-byte length): 70000 bytes (0x00011170)
      // 5a (MT 2, AI 26) + 00011170 (4 bytes) + data
      const hexData = '00'.repeat(70000)
      const result = parseString('5a00011170' + hexData)
      expect(result.value.length).toBe(70000)
    })

    it('should parse 8-byte length (AI 27)', () => {
      const { parseString } = useCborString()

      // MT 2, AI 27 (8-byte length): 100 bytes (using 8-byte encoding)
      // 5b (MT 2, AI 27) + 0000000000000064 (8 bytes) + data
      const hexData = '00'.repeat(100)
      const result = parseString('5b0000000000000064' + hexData)
      expect(result.value.length).toBe(100)
    })

    it('should parse text string with 4-byte length (AI 26)', () => {
      const { parseString } = useCborString()

      // MT 3, AI 26: 1000 bytes
      const text = 'a'.repeat(1000)
      const hexData = Buffer.from(text, 'utf-8').toString('hex')
      const result = parseString('7a000003e8' + hexData)
      expect(result.value).toBe(text)
    })

    it('should parse text string with 8-byte length (AI 27)', () => {
      const { parseString } = useCborString()

      // MT 3, AI 27: 50 bytes (using 8-byte encoding)
      const text = 'x'.repeat(50)
      const hexData = Buffer.from(text, 'utf-8').toString('hex')
      const result = parseString('7b0000000000000032' + hexData)
      expect(result.value).toBe(text)
    })
  })

  describe('parseLength - Invalid Additional Info', () => {
    it('should throw error for reserved AI 28', () => {
      const { parseString } = useCborString()

      // MT 2, AI 28 - reserved
      expect(() => parseString('5c')).toThrow('Invalid additional info: 28')
    })

    it('should throw error for reserved AI 29', () => {
      const { parseString } = useCborString()

      // MT 2, AI 29 - reserved
      expect(() => parseString('5d')).toThrow('Invalid additional info: 29')
    })

    it('should throw error for reserved AI 30', () => {
      const { parseString } = useCborString()

      // MT 2, AI 30 - reserved
      expect(() => parseString('5e')).toThrow('Invalid additional info: 30')
    })
  })

  describe('parseByteString - Wrong Major Type', () => {
    it('should throw error when major type is not 2', () => {
      const { parseByteString } = useCborString()
      const buffer = new Uint8Array([0x00]) // MT 0, not MT 2

      expect(() => parseByteString(buffer, 0)).toThrow('Expected major type 2 (byte string), got 0')
    })

    it('should throw error for MT 3 (text string)', () => {
      const { parseByteString } = useCborString()
      const buffer = new Uint8Array([0x60]) // MT 3

      expect(() => parseByteString(buffer, 0)).toThrow('Expected major type 2 (byte string), got 3')
    })
  })

  describe('parseTextString - Wrong Major Type', () => {
    it('should throw error when major type is not 3', () => {
      const { parseTextString } = useCborString()
      const buffer = new Uint8Array([0x00]) // MT 0, not MT 3

      expect(() => parseTextString(buffer, 0)).toThrow('Expected major type 3 (text string), got 0')
    })

    it('should throw error for MT 2 (byte string)', () => {
      const { parseTextString } = useCborString()
      const buffer = new Uint8Array([0x40]) // MT 2

      expect(() => parseTextString(buffer, 0)).toThrow('Expected major type 3 (text string), got 2')
    })
  })

  describe('Indefinite Byte String - Invalid Chunks', () => {
    it('should throw error when chunk is not a byte string', () => {
      const { parseByteString } = useCborString()

      // MT 2, AI 31 (indefinite) + MT 3 text string chunk (invalid!) + break
      // 5f (indefinite byte string) + 6161 (text "a") + ff (break)
      const buffer = new Uint8Array([0x5f, 0x61, 0x61, 0xff])

      // The error is thrown when trying to parse the text string as a byte string
      expect(() => parseByteString(buffer, 0)).toThrow('Expected major type 2')
    })
  })

  describe('Indefinite Text String - Invalid Chunks', () => {
    it('should throw error when chunk is not a text string', () => {
      const { parseTextString } = useCborString()

      // MT 3, AI 31 (indefinite) + MT 2 byte string chunk (invalid!) + break
      // 7f (indefinite text string) + 4161 (byte string containing 'a') + ff (break)
      const buffer = new Uint8Array([0x7f, 0x41, 0x61, 0xff])

      // The error is thrown when trying to parse the byte string as a text string
      expect(() => parseTextString(buffer, 0)).toThrow('Expected major type 3')
    })
  })

  describe('parseString - Wrong Major Type', () => {
    it('should throw error for major type other than 2 or 3', () => {
      const { parseString } = useCborString()

      // MT 0 (integer) is not a string
      expect(() => parseString('00')).toThrow('Expected major type 2 or 3 (string), got 0')
    })

    it('should throw error for MT 4 (array)', () => {
      const { parseString } = useCborString()

      // MT 4 (array) is not a string
      expect(() => parseString('80')).toThrow('Expected major type 2 or 3 (string), got 4')
    })
  })

  describe('Insufficient Data Errors', () => {
    it('should throw error when byte string has insufficient data', () => {
      const { parseString } = useCborString()

      // MT 2, length 10, but only 5 bytes of data
      expect(() => parseString('4a0102030405')).toThrow('Insufficient data')
    })

    it('should throw error when text string has insufficient data', () => {
      const { parseString } = useCborString()

      // MT 3, length 10, but only 5 bytes of data
      expect(() => parseString('6a0102030405')).toThrow('Insufficient data')
    })

    it('should throw error when 1-byte length has no data', () => {
      const { parseString } = useCborString()

      // MT 2, AI 24 (1-byte length follows), but no length byte
      expect(() => parseString('58')).toThrow('Offset 1 is out of bounds')
    })

    it('should throw error when 2-byte length has insufficient bytes', () => {
      const { parseString } = useCborString()

      // MT 2, AI 25 (2-byte length follows), but only 1 byte
      expect(() => parseString('5901')).toThrow('Cannot read 2 bytes at offset 1')
    })
  })

  describe('Edge Cases', () => {
    it('should handle very long strings with proper encoding', () => {
      const { parseString } = useCborString()

      // Test boundary between encodings
      // 23 bytes: direct encoding
      const result1 = parseString('57' + '61'.repeat(23))
      expect(result1.value.length).toBe(23)

      // 24 bytes: 1-byte length
      const result2 = parseString('5818' + '61'.repeat(24))
      expect(result2.value.length).toBe(24)

      // 256 bytes: 2-byte length
      const result3 = parseString('590100' + '61'.repeat(256))
      expect(result3.value.length).toBe(256)
    })

    it('should handle indefinite byte strings with multiple chunks', () => {
      const { parseString } = useCborString()

      // Indefinite byte string with 3 chunks
      // 5f (indefinite) + 4101 (chunk 1: [0x01]) + 4102 (chunk 2: [0x02]) + 4103 (chunk 3: [0x03]) + ff (break)
      const result = parseString('5f410141024103ff')
      expect(result.value).toMatchObject({
        type: 'cbor-byte-string',
        bytes: new Uint8Array([0x01, 0x02, 0x03]),
        chunks: [
          new Uint8Array([0x01]),
          new Uint8Array([0x02]),
          new Uint8Array([0x03])
        ]
      })
    })

    it('should handle indefinite text strings with multiple chunks', () => {
      const { parseString } = useCborString()

      // Indefinite text string with 3 chunks
      // 7f (indefinite) + 6161 ("a") + 6162 ("b") + 6163 ("c") + ff (break)
      const result = parseString('7f616161626163ff')
      expect(result.value).toMatchObject({
        type: 'cbor-text-string',
        text: 'abc',
        chunks: ['a', 'b', 'c']
      })
    })
  })
})
