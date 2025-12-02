import { describe, it, expect } from 'vitest'
import { useCborInteger } from '../composables/useCborInteger'

describe('useCborInteger', () => {
  describe('parseUnsignedInteger (Major Type 0)', () => {
    it('should parse small integers (0-23) - direct encoding', () => {
      const { parseInteger } = useCborInteger()
      
      // Test case 1: Value 0 (RFC 8949 Appendix A)
      const result1 = parseInteger('00')
      expect(result1.value).toBe(0)
      expect(result1.bytesRead).toBe(1)
      
      // Test case 2: Value 10
      const result2 = parseInteger('0a')
      expect(result2.value).toBe(10)
      expect(result2.bytesRead).toBe(1)
      
      // Test case 3: Value 23 (maximum direct encoding)
      const result3 = parseInteger('17')
      expect(result3.value).toBe(23)
      expect(result3.bytesRead).toBe(1)
    })

    it('should parse 1-byte integers (24-255)', () => {
      const { parseInteger } = useCborInteger()
      
      // Test case 1: Value 24 (RFC 8949 Appendix A)
      const result1 = parseInteger('1818')
      expect(result1.value).toBe(24)
      expect(result1.bytesRead).toBe(2)
      
      // Test case 2: Value 100 (common Cardano value)
      const result2 = parseInteger('1864')
      expect(result2.value).toBe(100)
      expect(result2.bytesRead).toBe(2)
      
      // Test case 3: Value 255 (maximum 1-byte)
      const result3 = parseInteger('18ff')
      expect(result3.value).toBe(255)
      expect(result3.bytesRead).toBe(2)
    })

    it('should parse 2-byte integers (256-65535)', () => {
      const { parseInteger } = useCborInteger()
      
      // Test case 1: Value 1000 (RFC 8949 Appendix A)
      const result1 = parseInteger('1903e8')
      expect(result1.value).toBe(1000)
      expect(result1.bytesRead).toBe(3)
      
      // Test case 2: Value 256 (minimum 2-byte)
      const result2 = parseInteger('190100')
      expect(result2.value).toBe(256)
      expect(result2.bytesRead).toBe(3)
      
      // Test case 3: Value 65535 (maximum 2-byte)
      const result3 = parseInteger('19ffff')
      expect(result3.value).toBe(65535)
      expect(result3.bytesRead).toBe(3)
    })

    it('should parse 4-byte integers (up to 4294967295)', () => {
      const { parseInteger } = useCborInteger()
      
      // Test case 1: Value 1000000 (RFC 8949 / Cardano lovelace)
      const result1 = parseInteger('1a000f4240')
      expect(result1.value).toBe(1000000)
      expect(result1.bytesRead).toBe(5)
      
      // Test case 2: Value 65536 (minimum 4-byte)
      const result2 = parseInteger('1a00010000')
      expect(result2.value).toBe(65536)
      expect(result2.bytesRead).toBe(5)
      
      // Test case 3: Value 4294967295 (maximum 4-byte)
      const result3 = parseInteger('1affffffff')
      expect(result3.value).toBe(4294967295)
      expect(result3.bytesRead).toBe(5)
    })

    it('should parse 8-byte integers with BigInt for large values', () => {
      const { parseInteger } = useCborInteger()
      
      // Test case 1: Value within Number.MAX_SAFE_INTEGER (return number)
      const result1 = parseInteger('1b0000000000000064') // 100 in 8 bytes
      expect(result1.value).toBe(100)
      expect(typeof result1.value).toBe('number')
      expect(result1.bytesRead).toBe(9)
      
      // Test case 2: Value above Number.MAX_SAFE_INTEGER (return BigInt)
      const result2 = parseInteger('1b0020000000000000') // 9007199254740992
      expect(result2.value).toBe(9007199254740992n)
      expect(typeof result2.value).toBe('bigint')
      expect(result2.bytesRead).toBe(9)
      
      // Test case 3: Maximum 64-bit value (return BigInt)
      const result3 = parseInteger('1bffffffffffffffff')
      expect(result3.value).toBe(18446744073709551615n)
      expect(typeof result3.value).toBe('bigint')
      expect(result3.bytesRead).toBe(9)
    })
  })

  describe('parseNegativeInteger (Major Type 1)', () => {
    it('should parse small negative integers (-1 to -24)', () => {
      const { parseInteger } = useCborInteger()
      
      // Test case 1: Value -1 (RFC 8949 Appendix A)
      const result1 = parseInteger('20')
      expect(result1.value).toBe(-1)
      expect(result1.bytesRead).toBe(1)
      
      // Test case 2: Value -10
      const result2 = parseInteger('29')
      expect(result2.value).toBe(-10)
      expect(result2.bytesRead).toBe(1)
      
      // Test case 3: Value -24
      const result3 = parseInteger('37')
      expect(result3.value).toBe(-24)
      expect(result3.bytesRead).toBe(1)
    })

    it('should parse 1-byte negative integers (-25 to -256)', () => {
      const { parseInteger } = useCborInteger()
      
      // Test case 1: Value -100 (RFC 8949 Appendix A)
      const result1 = parseInteger('3863')
      expect(result1.value).toBe(-100)
      expect(result1.bytesRead).toBe(2)
      
      // Test case 2: Value -25
      const result2 = parseInteger('3818')
      expect(result2.value).toBe(-25)
      expect(result2.bytesRead).toBe(2)
      
      // Test case 3: Value -256
      const result3 = parseInteger('38ff')
      expect(result3.value).toBe(-256)
      expect(result3.bytesRead).toBe(2)
    })

    it('should parse 2-byte negative integers', () => {
      const { parseInteger } = useCborInteger()
      
      // Test case 1: Value -1000 (RFC 8949 Appendix A)
      const result1 = parseInteger('3903e7')
      expect(result1.value).toBe(-1000)
      expect(result1.bytesRead).toBe(3)
      
      // Test case 2: Value -257
      const result2 = parseInteger('390100')
      expect(result2.value).toBe(-257)
      expect(result2.bytesRead).toBe(3)
      
      // Test case 3: Value -65536
      const result3 = parseInteger('39ffff')
      expect(result3.value).toBe(-65536)
      expect(result3.bytesRead).toBe(3)
    })

    it('should parse large negative integers with BigInt', () => {
      const { parseInteger } = useCborInteger()
      
      // Test case 1: Within safe integer range (return number)
      const result1 = parseInteger('3b0000000000000063') // -100 in 8 bytes
      expect(result1.value).toBe(-100)
      expect(typeof result1.value).toBe('number')
      
      // Test case 2: Outside safe integer range (return BigInt)
      const result2 = parseInteger('3b001fffffffffffff') // Large negative
      expect(typeof result2.value).toBe('bigint')
      expect(result2.value).toBe(-9007199254740992n)
      
      // Test case 3: Maximum negative value
      const result3 = parseInteger('3bffffffffffffffff')
      expect(result3.value).toBe(-18446744073709551616n)
      expect(typeof result3.value).toBe('bigint')
    })
  })

  describe('Real-world Cardano examples', () => {
    it('should parse Cardano lovelace amounts', () => {
      const { parseInteger } = useCborInteger()
      
      // 1 ADA = 1,000,000 lovelace
      const oneAda = parseInteger('1a000f4240')
      expect(oneAda.value).toBe(1000000)
      
      // 100 ADA = 100,000,000 lovelace
      const hundredAda = parseInteger('1a05f5e100')
      expect(hundredAda.value).toBe(100000000)
      
      // 1000 ADA = 1,000,000,000 lovelace
      const thousandAda = parseInteger('1a3b9aca00')
      expect(thousandAda.value).toBe(1000000000)
    })
  })
})
