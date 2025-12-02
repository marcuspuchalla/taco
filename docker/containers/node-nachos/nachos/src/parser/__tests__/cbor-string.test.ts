import { describe, it, expect } from 'vitest'
import { useCborString } from '../composables/useCborString'

describe('useCborString', () => {
  describe('parseByteString (Major Type 2)', () => {
    it('should parse empty byte string', () => {
      const { parseString } = useCborString()
      
      // Test case: Empty byte string (RFC 8949 Appendix A)
      // Hex: 0x40 = 0b010_00000 (MT 2, length 0)
      const result = parseString('40')
      expect(result.value).toEqual(new Uint8Array([]))
      expect(result.bytesRead).toBe(1)
    })

    it('should parse small byte strings (length 0-23)', () => {
      const { parseString } = useCborString()
      
      // Test case 1: 4 bytes (RFC 8949 Appendix A)
      // Hex: 0x44 0x01 0x02 0x03 0x04
      const result1 = parseString('4401020304')
      expect(result1.value).toEqual(new Uint8Array([1, 2, 3, 4]))
      expect(result1.bytesRead).toBe(5)
      
      // Test case 2: Single byte
      const result2 = parseString('41ff')
      expect(result2.value).toEqual(new Uint8Array([0xff]))
      expect(result2.bytesRead).toBe(2)
      
      // Test case 3: 3 bytes
      const result3 = parseString('43aabbcc')
      expect(result3.value).toEqual(new Uint8Array([0xaa, 0xbb, 0xcc]))
      expect(result3.bytesRead).toBe(4)
    })

    it('should parse 1-byte length byte strings (24-255 bytes)', () => {
      const { parseString } = useCborString()
      
      // Test case: 24 bytes
      const hexData = '00112233445566778899aabbccddeeff0011223344556677'
      const result = parseString('5818' + hexData)
      expect(result.value.length).toBe(24)
      expect(result.value[0]).toBe(0x00)
      expect(result.value[23]).toBe(0x77)
      expect(result.bytesRead).toBe(26) // 2 (header) + 24 (data)
    })

    it('should parse 2-byte length byte strings (256+ bytes)', () => {
      const { parseString } = useCborString()
      
      // Test case: 256 bytes
      const hexData = '00'.repeat(256)
      const result = parseString('590100' + hexData)
      expect(result.value.length).toBe(256)
      expect(result.bytesRead).toBe(259) // 3 (header) + 256 (data)
    })

    it('should parse Cardano transaction hash (32 bytes)', () => {
      const { parseString } = useCborString()
      
      // Real Cardano transaction hash (32 bytes)
      const txHash = '48bd01d51e580cde15afa6d28f63d89c9137b93a910e5941192e26b1290610670'
      const result = parseString('5820' + txHash.slice(0, 64))
      expect(result.value.length).toBe(32)
      expect(result.bytesRead).toBe(34) // 2 (header) + 32 (hash)
    })
  })

  describe('parseTextString (Major Type 3)', () => {
    it('should parse empty text string', () => {
      const { parseString } = useCborString()
      
      // Test case: Empty text string (RFC 8949 Appendix A)
      // Hex: 0x60 = 0b011_00000 (MT 3, length 0)
      const result = parseString('60')
      expect(result.value).toBe('')
      expect(result.bytesRead).toBe(1)
    })

    it('should parse single character ASCII strings', () => {
      const { parseString } = useCborString()
      
      // Test case 1: "a" (RFC 8949 Appendix A)
      const result1 = parseString('6161')
      expect(result1.value).toBe('a')
      expect(result1.bytesRead).toBe(2)
      
      // Test case 2: "A"
      const result2 = parseString('6141')
      expect(result2.value).toBe('A')
      expect(result2.bytesRead).toBe(2)
      
      // Test case 3: "z"
      const result3 = parseString('617a')
      expect(result3.value).toBe('z')
      expect(result3.bytesRead).toBe(2)
    })

    it('should parse multi-character ASCII strings', () => {
      const { parseString } = useCborString()
      
      // Test case 1: "IETF" (RFC 8949 Appendix A)
      const result1 = parseString('6449455446')
      expect(result1.value).toBe('IETF')
      expect(result1.bytesRead).toBe(5)
      
      // Test case 2: "Hello"
      const result2 = parseString('6548656c6c6f')
      expect(result2.value).toBe('Hello')
      expect(result2.bytesRead).toBe(6)
      
      // Test case 3: "CBOR"
      const result3 = parseString('6443424f52')
      expect(result3.value).toBe('CBOR')
      expect(result3.bytesRead).toBe(5)
    })

    it('should parse UTF-8 encoded strings', () => {
      const { parseString } = useCborString()
      
      // Test case 1: "あ" (Japanese Hiragana, 3 bytes in UTF-8)
      const result1 = parseString('63e38182')
      expect(result1.value).toBe('あ')
      expect(result1.bytesRead).toBe(4)
      
      // Test case 2: "🎉" (emoji, 4 bytes in UTF-8)
      const result2 = parseString('64f09f8e89')
      expect(result2.value).toBe('🎉')
      expect(result2.bytesRead).toBe(5)
      
      // Test case 3: "café" (é is 2 bytes in UTF-8: c3 a9)
      const result3 = parseString('65636166c3a9')
      expect(result3.value).toBe('café')
      expect(result3.bytesRead).toBe(6)
    })

    it('should parse 1-byte length text strings (24+ characters)', () => {
      const { parseString } = useCborString()
      
      // Test case: 24 character string
      const text = 'abcdefghijklmnopqrstuvwx'
      const hexData = text.split('').map(c => c.charCodeAt(0).toString(16)).join('')
      const result = parseString('7818' + hexData)
      expect(result.value).toBe(text)
      expect(result.bytesRead).toBe(26) // 2 (header) + 24 (data)
    })

    it('should parse Cardano metadata strings', () => {
      const { parseString } = useCborString()
      
      // Test case: "Hello World" (common Cardano metadata)
      const result = parseString('6b48656c6c6f20576f726c64')
      expect(result.value).toBe('Hello World')
      expect(result.bytesRead).toBe(12)
    })
  })

  describe('parseString with type detection', () => {
    it('should correctly identify and parse byte strings (MT 2)', () => {
      const { parseString } = useCborString()
      
      // Major Type 2 should return Uint8Array
      const result = parseString('4401020304')
      expect(result.value).toBeInstanceOf(Uint8Array)
      expect(result.value).toEqual(new Uint8Array([1, 2, 3, 4]))
    })

    it('should correctly identify and parse text strings (MT 3)', () => {
      const { parseString } = useCborString()
      
      // Major Type 3 should return string
      const result = parseString('6449455446')
      expect(typeof result.value).toBe('string')
      expect(result.value).toBe('IETF')
    })

    it('should reject invalid major types', () => {
      const { parseString } = useCborString()
      
      // Major Type 0 (integer) should be rejected
      expect(() => parseString('00')).toThrow()
      
      // Major Type 4 (array) should be rejected
      expect(() => parseString('80')).toThrow()
    })
  })

  describe('edge cases and error handling', () => {
    it('should handle strings at boundary lengths', () => {
      const { parseString } = useCborString()
      
      // Test case 1: 23 bytes (max direct encoding)
      const result1 = parseString('57' + '00'.repeat(23))
      expect(result1.value.length).toBe(23)
      expect(result1.bytesRead).toBe(24)
      
      // Test case 2: 24 bytes (first 1-byte length)
      const result2 = parseString('5818' + '00'.repeat(24))
      expect(result2.value.length).toBe(24)
      expect(result2.bytesRead).toBe(26)
    })

    it('should handle empty strings correctly', () => {
      const { parseString } = useCborString()
      
      // Empty byte string
      const result1 = parseString('40')
      expect(result1.value).toEqual(new Uint8Array([]))
      
      // Empty text string
      const result2 = parseString('60')
      expect(result2.value).toBe('')
    })

    it('should handle strings with special characters', () => {
      const { parseString } = useCborString()
      
      // Text with emoji "Hi 😀" (😀 is 4 bytes: f09f9880)
      // Hex: 68 (text string, length 8) + 486920f09f9880
      const result = parseString('6748 69 20f09f9880'.replace(/\s/g, ''))
      expect(result.value).toBe('Hi 😀')
    })
  })
})
