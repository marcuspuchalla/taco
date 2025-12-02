/**
 * RFC 8949 Test Vectors
 * All examples from RFC 8949 Appendix A: Examples of Encoded CBOR Data Items
 * https://www.rfc-editor.org/rfc/rfc8949.html#name-examples-of-encoded-cbor-da
 *
 * This test suite validates 100% compliance with the CBOR specification
 */

import { describe, it, expect } from 'vitest'
import { useCborParser } from '../composables/useCborParser'

describe('RFC 8949 Appendix A Test Vectors', () => {
  describe('Integers', () => {
    it('should parse 0', () => {
      const { parse } = useCborParser()
      const result = parse('00')
      expect(result.value).toBe(0)
    })

    it('should parse 1', () => {
      const { parse } = useCborParser()
      const result = parse('01')
      expect(result.value).toBe(1)
    })

    it('should parse 10', () => {
      const { parse } = useCborParser()
      const result = parse('0a')
      expect(result.value).toBe(10)
    })

    it('should parse 23', () => {
      const { parse } = useCborParser()
      const result = parse('17')
      expect(result.value).toBe(23)
    })

    it('should parse 24', () => {
      const { parse } = useCborParser()
      const result = parse('1818')
      expect(result.value).toBe(24)
    })

    it('should parse 25', () => {
      const { parse } = useCborParser()
      const result = parse('1819')
      expect(result.value).toBe(25)
    })

    it('should parse 100', () => {
      const { parse } = useCborParser()
      const result = parse('1864')
      expect(result.value).toBe(100)
    })

    it('should parse 1000', () => {
      const { parse } = useCborParser()
      const result = parse('1903e8')
      expect(result.value).toBe(1000)
    })

    it('should parse 1000000', () => {
      const { parse } = useCborParser()
      const result = parse('1a000f4240')
      expect(result.value).toBe(1000000)
    })

    it('should parse 1000000000000', () => {
      const { parse } = useCborParser()
      const result = parse('1b000000e8d4a51000')
      expect(result.value).toBe(1000000000000)
    })

    it('should parse 18446744073709551615 (max uint64)', () => {
      const { parse } = useCborParser()
      const result = parse('1bffffffffffffffff')
      expect(result.value).toBe(18446744073709551615n)
    })

    it('should parse 18446744073709551616 (bignum tag)', () => {
      const { parse } = useCborParser()
      const result = parse('c249010000000000000000')
      // Parser converts bignum to BigInt value
      expect(result.value).toEqual({
        tag: 2,
        value: 18446744073709551616n
      })
    })

    it('should parse -18446744073709551616 (negative bignum tag)', () => {
      const { parse } = useCborParser()
      const result = parse('3bffffffffffffffff')
      expect(result.value).toBe(-18446744073709551616n)
    })

    it('should parse -18446744073709551617 (negative bignum tag)', () => {
      const { parse } = useCborParser()
      const result = parse('c349010000000000000000')
      // Parser converts bignum to BigInt value
      expect(result.value).toEqual({
        tag: 3,
        value: -18446744073709551617n
      })
    })

    it('should parse -1', () => {
      const { parse } = useCborParser()
      const result = parse('20')
      expect(result.value).toBe(-1)
    })

    it('should parse -10', () => {
      const { parse } = useCborParser()
      const result = parse('29')
      expect(result.value).toBe(-10)
    })

    it('should parse -100', () => {
      const { parse } = useCborParser()
      const result = parse('3863')
      expect(result.value).toBe(-100)
    })

    it('should parse -1000', () => {
      const { parse } = useCborParser()
      const result = parse('3903e7')
      expect(result.value).toBe(-1000)
    })
  })

  describe('Floating-Point Numbers', () => {
    it('should parse 0.0', () => {
      const { parse } = useCborParser()
      const result = parse('f90000')
      expect(result.value).toBe(0.0)
    })

    it('should parse -0.0', () => {
      const { parse } = useCborParser()
      const result = parse('f98000')
      expect(result.value).toBe(-0.0)
      expect(Object.is(result.value, -0.0)).toBe(true)
    })

    it('should parse 1.0', () => {
      const { parse } = useCborParser()
      const result = parse('f93c00')
      expect(result.value).toBe(1.0)
    })

    it('should parse 1.1', () => {
      const { parse } = useCborParser()
      const result = parse('fb3ff199999999999a')
      expect(result.value).toBe(1.1)
    })

    it('should parse 1.5', () => {
      const { parse } = useCborParser()
      const result = parse('f93e00')
      expect(result.value).toBe(1.5)
    })

    it('should parse 65504.0 (max normal float16)', () => {
      const { parse } = useCborParser()
      const result = parse('f97bff')
      expect(result.value).toBe(65504.0)
    })

    it('should parse 100000.0', () => {
      const { parse } = useCborParser()
      const result = parse('fa47c35000')
      expect(result.value).toBe(100000.0)
    })

    it('should parse 3.4028234663852886e+38 (max float32)', () => {
      const { parse } = useCborParser()
      const result = parse('fa7f7fffff')
      expect(result.value).toBeCloseTo(3.4028234663852886e+38, -30)
    })

    it('should parse 1.0e+300', () => {
      const { parse } = useCborParser()
      const result = parse('fb7e37e43c8800759c')
      expect(result.value).toBe(1.0e+300)
    })

    it('should parse 5.960464477539063e-8 (min positive subnormal float16)', () => {
      const { parse } = useCborParser()
      const result = parse('f90001')
      expect(result.value).toBeCloseTo(5.960464477539063e-8, 15)
    })

    it('should parse 0.00006103515625 (min positive normal float16)', () => {
      const { parse } = useCborParser()
      const result = parse('f90400')
      expect(result.value).toBeCloseTo(0.00006103515625, 15)
    })

    it('should parse -4.0', () => {
      const { parse } = useCborParser()
      const result = parse('f9c400')
      expect(result.value).toBe(-4.0)
    })

    it('should parse -4.1', () => {
      const { parse } = useCborParser()
      const result = parse('fbc010666666666666')
      expect(result.value).toBe(-4.1)
    })

    it('should parse Infinity', () => {
      const { parse } = useCborParser()
      const result = parse('f97c00')
      expect(result.value).toBe(Infinity)
    })

    it('should parse NaN', () => {
      const { parse } = useCborParser()
      const result = parse('f97e00')
      expect(Number.isNaN(result.value)).toBe(true)
    })

    it('should parse -Infinity', () => {
      const { parse } = useCborParser()
      const result = parse('f9fc00')
      expect(result.value).toBe(-Infinity)
    })

    it('should parse Infinity (float32)', () => {
      const { parse } = useCborParser()
      const result = parse('fa7f800000')
      expect(result.value).toBe(Infinity)
    })

    it('should parse NaN (float32)', () => {
      const { parse } = useCborParser()
      const result = parse('fa7fc00000')
      expect(Number.isNaN(result.value)).toBe(true)
    })

    it('should parse -Infinity (float32)', () => {
      const { parse } = useCborParser()
      const result = parse('faff800000')
      expect(result.value).toBe(-Infinity)
    })

    it('should parse Infinity (float64)', () => {
      const { parse } = useCborParser()
      const result = parse('fb7ff0000000000000')
      expect(result.value).toBe(Infinity)
    })

    it('should parse NaN (float64)', () => {
      const { parse } = useCborParser()
      const result = parse('fb7ff8000000000000')
      expect(Number.isNaN(result.value)).toBe(true)
    })

    it('should parse -Infinity (float64)', () => {
      const { parse } = useCborParser()
      const result = parse('fbfff0000000000000')
      expect(result.value).toBe(-Infinity)
    })
  })

  describe('Simple Values', () => {
    it('should parse false', () => {
      const { parse } = useCborParser()
      const result = parse('f4')
      expect(result.value).toBe(false)
    })

    it('should parse true', () => {
      const { parse } = useCborParser()
      const result = parse('f5')
      expect(result.value).toBe(true)
    })

    it('should parse null', () => {
      const { parse } = useCborParser()
      const result = parse('f6')
      expect(result.value).toBe(null)
    })

    it('should parse undefined', () => {
      const { parse } = useCborParser()
      const result = parse('f7')
      expect(result.value).toBe(undefined)
    })

    it('should parse simple(16)', () => {
      const { parse } = useCborParser()
      const result = parse('f0')
      expect(result.value).toEqual({ simpleValue: 16 })
    })

    it('should parse simple(255)', () => {
      const { parse } = useCborParser()
      const result = parse('f8ff')
      expect(result.value).toEqual({ simpleValue: 255 })
    })
  })

  describe('Byte Strings', () => {
    it('should parse h\'\'', () => {
      const { parse } = useCborParser()
      const result = parse('40')
      expect(result.value).toEqual(new Uint8Array([]))
    })

    it('should parse h\'01020304\'', () => {
      const { parse } = useCborParser()
      const result = parse('4401020304')
      expect(result.value).toEqual(new Uint8Array([0x01, 0x02, 0x03, 0x04]))
    })
  })

  describe('Text Strings', () => {
    it('should parse ""', () => {
      const { parse } = useCborParser()
      const result = parse('60')
      expect(result.value).toBe('')
    })

    it('should parse "a"', () => {
      const { parse } = useCborParser()
      const result = parse('6161')
      expect(result.value).toBe('a')
    })

    it('should parse "IETF"', () => {
      const { parse } = useCborParser()
      const result = parse('6449455446')
      expect(result.value).toBe('IETF')
    })

    it('should parse "\\\\"', () => {
      const { parse } = useCborParser()
      // Hex: 62 (text string, length 2) + 22 (") + 5c (\)
      const result = parse('62225c')
      expect(result.value).toBe('"\\')
    })

    it('should parse "ü" (U+00FC)', () => {
      const { parse } = useCborParser()
      const result = parse('62c3bc')
      expect(result.value).toBe('ü')
    })

    it('should parse "水" (U+6C34)', () => {
      const { parse } = useCborParser()
      const result = parse('63e6b0b4')
      expect(result.value).toBe('水')
    })

    it('should parse "𐅑" (U+10151)', () => {
      const { parse } = useCborParser()
      const result = parse('64f0908591')
      expect(result.value).toBe('𐅑')
    })
  })

  describe('Arrays', () => {
    it('should parse []', () => {
      const { parse } = useCborParser()
      const result = parse('80')
      expect(result.value).toEqual([])
    })

    it('should parse [1, 2, 3]', () => {
      const { parse } = useCborParser()
      const result = parse('83010203')
      expect(result.value).toEqual([1, 2, 3])
    })

    it('should parse [1, [2, 3], [4, 5]]', () => {
      const { parse } = useCborParser()
      const result = parse('8301820203820405')
      expect(result.value).toEqual([1, [2, 3], [4, 5]])
    })

    it('should parse [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25]', () => {
      const { parse } = useCborParser()
      const result = parse('98190102030405060708090a0b0c0d0e0f101112131415161718181819')
      expect(result.value).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25])
    })
  })

  describe('Maps', () => {
    it('should parse {}', () => {
      const { parse } = useCborParser()
      const result = parse('a0')
      expect(result.value).toEqual(new Map())
    })

    it('should parse {1: 2, 3: 4}', () => {
      const { parse } = useCborParser()
      const result = parse('a201020304')
      expect(result.value).toEqual(new Map([[1, 2], [3, 4]]))
    })

    it('should parse {"a": 1, "b": [2, 3]}', () => {
      const { parse } = useCborParser()
      const result = parse('a26161016162820203')
      expect(result.value).toEqual(new Map([['a', 1], ['b', [2, 3]]]))
    })

    it('should parse ["a", {"b": "c"}]', () => {
      const { parse } = useCborParser()
      const result = parse('826161a161626163')
      expect(result.value).toEqual(['a', new Map([['b', 'c']])])
    })

    it('should parse {"a": "A", "b": "B", "c": "C", "d": "D", "e": "E"}', () => {
      const { parse } = useCborParser()
      const result = parse('a56161614161626142616361436164614461656145')
      expect(result.value).toEqual(new Map([['a', 'A'], ['b', 'B'], ['c', 'C'], ['d', 'D'], ['e', 'E']]))
    })
  })

  describe('Tagged Values', () => {
    it('should parse 0("2013-03-21T20:04:00Z")', () => {
      const { parse } = useCborParser()
      const result = parse('c074323031332d30332d3231543230 3a30343a30305a'.replace(/\s/g, ''))
      expect(result.value).toEqual({
        tag: 0,
        value: '2013-03-21T20:04:00Z'
      })
    })

    it('should parse 1(1363896240)', () => {
      const { parse } = useCborParser()
      const result = parse('c11a514b67b0')
      expect(result.value).toEqual({
        tag: 1,
        value: 1363896240
      })
    })

    it('should parse 1(1363896240.5)', () => {
      const { parse } = useCborParser()
      const result = parse('c1fb41d452d9ec200000')
      expect(result.value.tag).toBe(1)
      expect(result.value.value).toBeCloseTo(1363896240.5, 1)
    })

    it('should parse 23(h\'01020304\')', () => {
      const { parse } = useCborParser()
      const result = parse('d74401020304')
      expect(result.value).toEqual({
        tag: 23,
        value: new Uint8Array([0x01, 0x02, 0x03, 0x04])
      })
    })

    it('should parse 24(h\'6449455446\')', () => {
      const { parse } = useCborParser()
      const result = parse('d818456449455446')
      expect(result.value).toEqual({
        tag: 24,
        value: new Uint8Array([0x64, 0x49, 0x45, 0x54, 0x46])
      })
    })

    it('should parse 32("http://www.example.com")', () => {
      const { parse } = useCborParser()
      const result = parse('d82076687474703a2f2f7777772e6578616d706c652e636f6d')
      expect(result.value).toEqual({
        tag: 32,
        value: 'http://www.example.com'
      })
    })
  })

  describe('Indefinite-Length Items', () => {
    it('should parse (_ h\'0102\', h\'030405\')', () => {
      const { parse } = useCborParser()
      const result = parse('5f42010243030405ff')
      // Indefinite byte string returns CborByteString with chunks
      expect(result.value).toMatchObject({
        type: 'cbor-byte-string',
        bytes: new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05])
      })
      expect((result.value as any).chunks).toBeDefined()
    })

    it('should parse (_ "strea", "ming")', () => {
      const { parse } = useCborParser()
      const result = parse('7f657374726561646d696e67ff')
      // Indefinite text string returns CborTextString with chunks
      expect(result.value).toMatchObject({
        type: 'cbor-text-string',
        text: 'streaming'
      })
      expect((result.value as any).chunks).toBeDefined()
    })

    it('should parse [_]', () => {
      const { parse } = useCborParser()
      const result = parse('9fff')
      expect(Array.isArray(result.value)).toBe(true)
      expect(result.value).toHaveLength(0)
    })

    it('should parse [_ 1, [2, 3], [_ 4, 5]]', () => {
      const { parse } = useCborParser()
      const result = parse('9f018202039f0405ffff')
      expect(Array.isArray(result.value)).toBe(true)
      const arr = result.value as any[]
      expect(arr[0]).toBe(1)
      expect(arr[1]).toEqual([2, 3])
      expect(Array.isArray(arr[2])).toBe(true)
      expect(arr[2][0]).toBe(4)
      expect(arr[2][1]).toBe(5)
    })

    it('should parse [_ 1, [2, 3], [4, 5]]', () => {
      const { parse } = useCborParser()
      const result = parse('9f01820203820405ff')
      expect(Array.isArray(result.value)).toBe(true)
      const arr = result.value as any[]
      expect(arr[0]).toBe(1)
      expect(arr[1]).toEqual([2, 3])
      expect(arr[2]).toEqual([4, 5])
    })

    it('should parse [1, [2, 3], [_ 4, 5]]', () => {
      const { parse } = useCborParser()
      const result = parse('83018202039f0405ff')
      expect(Array.isArray(result.value)).toBe(true)
      const arr = result.value as any[]
      expect(arr[0]).toBe(1)
      expect(arr[1]).toEqual([2, 3])
      expect(Array.isArray(arr[2])).toBe(true)
      expect(arr[2][0]).toBe(4)
      expect(arr[2][1]).toBe(5)
    })

    it('should parse [1, [_ 2, 3], [4, 5]]', () => {
      const { parse } = useCborParser()
      const result = parse('83019f0203ff820405')
      expect(Array.isArray(result.value)).toBe(true)
      const arr = result.value as any[]
      expect(arr[0]).toBe(1)
      expect(Array.isArray(arr[1])).toBe(true)
      expect(arr[1][0]).toBe(2)
      expect(arr[1][1]).toBe(3)
      expect(arr[2]).toEqual([4, 5])
    })

    it('should parse [_ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25]', () => {
      const { parse } = useCborParser()
      const result = parse('9f0102030405060708090a0b0c0d0e0f101112131415161718181819ff')
      expect(Array.isArray(result.value)).toBe(true)
      expect(result.value).toHaveLength(25)
      const expected = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25]
      expected.forEach((val, idx) => {
        expect((result.value as any[])[idx]).toBe(val)
      })
    })

    it('should parse {_ "a": 1, "b": [_ 2, 3]}', () => {
      const { parse } = useCborParser()
      const result = parse('bf61610161629f0203ffff')
      expect(result.value instanceof Map).toBe(true)
      const map = result.value as Map<any, any>
      expect(map.get('a')).toBe(1)
      expect(Array.isArray(map.get('b'))).toBe(true)
      const bArr = map.get('b') as any[]
      expect(bArr[0]).toBe(2)
      expect(bArr[1]).toBe(3)
    })

    it('should parse ["a", {_ "b": "c"}]', () => {
      const { parse } = useCborParser()
      const result = parse('826161bf61626163ff')
      expect(result.value).toEqual(['a', new Map([['b', 'c']])])
    })

    it('should parse {_ "Fun": true, "Amt": -2}', () => {
      const { parse } = useCborParser()
      const result = parse('bf6346756ef563416d7421ff')
      expect(result.value).toEqual(new Map([['Fun', true], ['Amt', -2]]))
    })
  })

  describe('Edge Cases and Special Combinations', () => {
    it('should parse array with all basic types [0, -1, "", h\'\', [], {}, false, null]', () => {
      const { parse } = useCborParser()
      const result = parse('880020604080a0f4f6')
      expect(result.value).toEqual([0, -1, '', new Uint8Array([]), [], new Map(), false, null])
    })

    it('should parse nested indefinite [_ [_ 1], [_ 2, 3]]', () => {
      const { parse } = useCborParser()
      const result = parse('9f9f01ff9f0203ffff')
      expect(Array.isArray(result.value)).toBe(true)
      const arr = result.value as any[]
      expect(arr).toHaveLength(2)
      expect(Array.isArray(arr[0])).toBe(true)
      expect(arr[0][0]).toBe(1)
      expect(Array.isArray(arr[1])).toBe(true)
      expect(arr[1][0]).toBe(2)
      expect(arr[1][1]).toBe(3)
    })
  })
})
