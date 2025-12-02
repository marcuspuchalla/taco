/**
 * CBOR Collection Parser Tests
 * Major Type 4 (Arrays) and Major Type 5 (Maps)
 * Following RFC 8949 specification
 */

import { describe, it, expect } from 'vitest'
import { useCborCollection } from '../composables/useCborCollection'

describe('useCborCollection', () => {
  describe('parseArray (Major Type 4)', () => {
    describe('Empty and Small Arrays', () => {
      it('should parse empty array', () => {
        const { parseArray } = useCborCollection()

        // RFC 8949: [] = 0x80
        const result = parseArray('80')
        expect(result.value).toEqual([])
        expect(result.bytesRead).toBe(1)
      })

      it('should parse array with small integers [1, 2, 3]', () => {
        const { parseArray } = useCborCollection()

        // RFC 8949: [1, 2, 3] = 0x83 0x01 0x02 0x03
        const result = parseArray('83010203')
        expect(result.value).toEqual([1, 2, 3])
        expect(result.bytesRead).toBe(4)
      })

      it('should parse array with mixed values [1, 23, 100]', () => {
        const { parseArray } = useCborCollection()

        // [1, 23, 100] = 0x83 0x01 0x17 0x18 0x64
        const result = parseArray('8301171864')
        expect(result.value).toEqual([1, 23, 100])
        expect(result.bytesRead).toBe(5)
      })
    })

    describe('Arrays with Strings', () => {
      it('should parse array with text strings ["a", "b", "c"]', () => {
        const { parseArray } = useCborCollection()

        // ["a", "b", "c"] = 0x83 0x61 0x61 0x61 0x62 0x61 0x63
        const result = parseArray('83616161626163')
        expect(result.value).toEqual(['a', 'b', 'c'])
        expect(result.bytesRead).toBe(7)
      })

      it('should parse array with empty string [""]', () => {
        const { parseArray } = useCborCollection()

        // [""] = 0x81 0x60
        const result = parseArray('8160')
        expect(result.value).toEqual([''])
        expect(result.bytesRead).toBe(2)
      })

      it('should parse array with UTF-8 strings ["Hello", "世界"]', () => {
        const { parseArray } = useCborCollection()

        // ["Hello", "世界"]
        // "Hello" = 0x65 "H" "e" "l" "l" "o"
        // "世界" = 0x66 0xe4 0xb8 0x96 0xe7 0x95 0x8c
        const result = parseArray('826548656c6c6f66e4b896e7958c')
        expect(result.value).toEqual(['Hello', '世界'])
        expect(result.bytesRead).toBe(14)
      })
    })

    describe('Nested Arrays', () => {
      it('should parse nested array [[1, 2], [3, 4]]', () => {
        const { parseArray } = useCborCollection()

        // [[1, 2], [3, 4]] = 0x82 [0x82 0x01 0x02] [0x82 0x03 0x04]
        const result = parseArray('828201028203 04')
        expect(result.value).toEqual([[1, 2], [3, 4]])
        expect(result.bytesRead).toBe(7)
      })

      it('should parse deeply nested arrays [[[1]]]', () => {
        const { parseArray } = useCborCollection()

        // [[[1]]] = 0x81 0x81 0x81 0x01
        const result = parseArray('81818101')
        expect(result.value).toEqual([[[1]]])
        expect(result.bytesRead).toBe(4)
      })

      it('should parse mixed nested structure [1, [2, 3], 4]', () => {
        const { parseArray } = useCborCollection()

        // [1, [2, 3], 4] = 0x83 0x01 [0x82 0x02 0x03] 0x04
        const result = parseArray('83018202 0304')
        expect(result.value).toEqual([1, [2, 3], 4])
        expect(result.bytesRead).toBe(6)
      })
    })

    describe('Arrays with 1-byte Length Encoding', () => {
      it('should parse array with 24 elements (1-byte length)', () => {
        const { parseArray } = useCborCollection()

        // Array of 24 zeros = 0x98 0x18 + 24 times 0x00
        const hex = '9818' + '00'.repeat(24)
        const result = parseArray(hex)
        expect(result.value).toHaveLength(24)
        expect(result.value.every(v => v === 0)).toBe(true)
        expect(result.bytesRead).toBe(2 + 24)
      })

      it('should parse array with 100 integers (1-byte length)', () => {
        const { parseArray } = useCborCollection()

        // Array of 100 ones = 0x98 0x64 + 100 times 0x01
        const hex = '9864' + '01'.repeat(100)
        const result = parseArray(hex)
        expect(result.value).toHaveLength(100)
        expect(result.value.every(v => v === 1)).toBe(true)
        expect(result.bytesRead).toBe(2 + 100)
      })
    })

    describe('Indefinite-Length Arrays', () => {
      it('should parse indefinite-length array [_ 1, 2, 3]', () => {
        const { parseArray } = useCborCollection()

        // [_ 1, 2, 3] = 0x9f 0x01 0x02 0x03 0xff (break)
        const result = parseArray('9f010203ff')
        expect(Array.isArray(result.value)).toBe(true)
        const arr = result.value as any[]
        expect(arr[0]).toBe(1)
        expect(arr[1]).toBe(2)
        expect(arr[2]).toBe(3)
        expect(result.bytesRead).toBe(5)
      })

      it('should parse indefinite-length empty array [_]', () => {
        const { parseArray } = useCborCollection()

        // [_] = 0x9f 0xff
        const result = parseArray('9fff')
        expect(Array.isArray(result.value)).toBe(true)
        expect(result.value).toHaveLength(0)
        expect(result.bytesRead).toBe(2)
      })

      it('should parse indefinite-length nested array [_ 1, [2, 3], [4, 5]]', () => {
        const { parseArray } = useCborCollection()

        // [_ 1, [2, 3], [4, 5]] = 0x9f 0x01 0x82 0x02 0x03 0x82 0x04 0x05 0xff
        const result = parseArray('9f018202038204 05ff')
        expect(Array.isArray(result.value)).toBe(true)
        const arr = result.value as any[]
        expect(arr[0]).toBe(1)
        expect(arr[1]).toEqual([2, 3])
        expect(arr[2]).toEqual([4, 5])
        expect(result.bytesRead).toBe(9)
      })
    })

    describe('Real Cardano Examples', () => {
      it('should parse Cardano UTXO array structure', () => {
        const { parseArray } = useCborCollection()

        // Simplified Cardano UTXO: [[txHash, outputIndex]]
        // Array of 1 element: [32-byte hash, integer 0]
        // 0x81 = array(1)
        // 0x82 = array(2) - the UTXO pair
        // 0x5820 = bytes(32) - transaction hash
        // 32 bytes of hash data
        // 0x00 = integer 0 (output index)
        const txHash = '48bd01d51e580cde15afa6d28f63d89c9137b93a910e5941192e26b129061067'
        const hex = `81825820${txHash}00`

        const result = parseArray(hex)
        expect(result.value).toHaveLength(1)
        expect(Array.isArray(result.value[0])).toBe(true)
        expect(result.value[0]).toHaveLength(2)
        expect(result.value[0][1]).toBe(0) // output index
      })

      it('should parse Cardano amount array [lovelace]', () => {
        const { parseArray } = useCborCollection()

        // Array with Cardano amounts: [1000000, 2000000, 5000000]
        // 1000000 = 0x1a 0x000f4240
        // 2000000 = 0x1a 0x001e8480
        // 5000000 = 0x1a 0x004c4b40
        const result = parseArray('831a000f42401a001e84801a004c4b40')
        expect(result.value).toEqual([1000000, 2000000, 5000000])
        expect(result.bytesRead).toBe(16)
      })
    })
  })

  describe('parseMap (Major Type 5)', () => {
    describe('Empty and Small Maps', () => {
      it('should parse empty map {}', () => {
        const { parseMap } = useCborCollection()

        // RFC 8949: {} = 0xa0
        const result = parseMap('a0')
        expect(result.value).toEqual(new Map())
        expect(result.bytesRead).toBe(1)
      })

      it('should parse map with one key-value pair {"a": 1}', () => {
        const { parseMap } = useCborCollection()

        // {"a": 1} = 0xa1 0x61 "a" 0x01
        const result = parseMap('a16161 01')
        expect(result.value).toEqual(new Map([['a', 1]]))
        expect(result.bytesRead).toBe(4)
      })

      it('should parse map with multiple pairs {"a": 1, "b": 2}', () => {
        const { parseMap } = useCborCollection()

        // {"a": 1, "b": 2} = 0xa2 0x61 "a" 0x01 0x61 "b" 0x02
        const result = parseMap('a26161016162 02')
        expect(result.value).toEqual(new Map([['a', 1], ['b', 2]]))
        expect(result.bytesRead).toBe(7)
      })

      it('should parse map with integer keys {1: "a", 2: "b"}', () => {
        const { parseMap } = useCborCollection()

        // {1: "a", 2: "b"} = 0xa2 0x01 0x61 "a" 0x02 0x61 "b"
        const result = parseMap('a2016161026162')
        expect(result.value).toEqual(new Map([[1, 'a'], [2, 'b']]))
        expect(result.bytesRead).toBe(7)
      })
    })

    describe('Maps with Different Value Types', () => {
      it('should parse map with string values {"name": "Alice", "age": "30"}', () => {
        const { parseMap } = useCborCollection()

        // {"name": "Alice", "age": "30"}
        // "name" = 0x64 0x6e 0x61 0x6d 0x65
        // "Alice" = 0x65 0x41 0x6c 0x69 0x63 0x65
        // "age" = 0x63 0x61 0x67 0x65
        // "30" = 0x62 0x33 0x30
        const result = parseMap('a2646e616d656541 6c696365636167656233 30')
        expect(result.value).toEqual(new Map([['name', 'Alice'], ['age', '30']]))
      })

      it('should parse map with mixed value types {"count": 42, "active": true}', () => {
        const { parseMap } = useCborCollection()

        // {"count": 42, "active": true}
        // Note: true requires simple value parser, will parse integer for now
        // "count" = 0x65 0x63 0x6f 0x75 0x6e 0x74
        // 42 = 0x18 0x2a
        const result = parseMap('a165636f756e74182a')
        expect(result.value).toEqual(new Map([['count', 42]]))
        expect(result.bytesRead).toBe(9)
      })
    })

    describe('Nested Maps', () => {
      it('should parse nested map {"outer": {"inner": 1}}', () => {
        const { parseMap } = useCborCollection()

        // {"outer": {"inner": 1}}
        // "outer" = 0x65 0x6f 0x75 0x74 0x65 0x72
        // {"inner": 1} = 0xa1 0x65 0x69 0x6e 0x6e 0x65 0x72 0x01
        const result = parseMap('a1656f75746572a1 65696e6e657201')
        expect(result.value).toEqual(new Map([['outer', new Map([['inner', 1]])]]))
      })

      it('should parse map with array value {"numbers": [1, 2, 3]}', () => {
        const { parseMap } = useCborCollection()

        // {"numbers": [1, 2, 3]}
        // "numbers" = 0x67 0x6e 0x75 0x6d 0x62 0x65 0x72 0x73
        // [1, 2, 3] = 0x83 0x01 0x02 0x03
        const result = parseMap('a1676e756d62657273 83010203')
        expect(result.value).toEqual(new Map([['numbers', [1, 2, 3]]]))
      })
    })

    describe('Indefinite-Length Maps', () => {
      it('should parse indefinite-length map {_ "a": 1, "b": 2}', () => {
        const { parseMap } = useCborCollection()

        // {_ "a": 1, "b": 2} = 0xbf 0x61 "a" 0x01 0x61 "b" 0x02 0xff
        const result = parseMap('bf61610161620 2ff')
        expect(result.value).toEqual(new Map([['a', 1], ['b', 2]]))
        expect(result.bytesRead).toBe(8)
      })

      it('should parse indefinite-length empty map {_}', () => {
        const { parseMap } = useCborCollection()

        // {_} = 0xbf 0xff
        const result = parseMap('bfff')
        expect(result.value).toEqual(new Map())
        expect(result.bytesRead).toBe(2)
      })
    })

    describe('Real Cardano Examples', () => {
      it('should parse Cardano balance object {"lovelace": 1000000}', () => {
        const { parseMap } = useCborCollection()

        // {"lovelace": 1000000}
        // "lovelace" = 0x68 0x6c 0x6f 0x76 0x65 0x6c 0x61 0x63 0x65
        // 1000000 = 0x1a 0x000f4240
        const result = parseMap('a1686c6f76656c6163 651a000f4240')
        expect(result.value).toEqual(new Map([['lovelace', 1000000]]))
      })

      it('should parse Cardano metadata map {"msg": "Hello"}', () => {
        const { parseMap } = useCborCollection()

        // {"msg": "Hello"}
        // "msg" = 0x63 0x6d 0x73 0x67
        // "Hello" = 0x65 0x48 0x65 0x6c 0x6c 0x6f
        const result = parseMap('a1636d73676548656c 6c6f')
        expect(result.value).toEqual(new Map([['msg', 'Hello']]))
      })

      it('should parse Cardano UTXO map structure', () => {
        const { parseMap } = useCborCollection()

        // Simplified: {"amount": 5000000, "address": "addr1..."}
        // "amount" = 0x66 0x61 0x6d 0x6f 0x75 0x6e 0x74
        // 5000000 = 0x1a 0x004c4b40
        // "address" = 0x67 0x61 0x64 0x64 0x72 0x65 0x73 0x73
        // "addr1" = 0x65 0x61 0x64 0x64 0x72 0x31
        const result = parseMap('a266616d6f756e741a 004c4b4067616464726573736561646472 31')
        expect(result.value).toEqual(new Map([['amount', 5000000], ['address', 'addr1']]))
      })
    })
  })

  describe('Error Handling', () => {
    it('should throw error for invalid major type in parseArray', () => {
      const { parseArray } = useCborCollection()

      // 0x00 = integer 0, not an array
      expect(() => parseArray('00')).toThrow('Expected major type 4 (array)')
    })

    it('should throw error for invalid major type in parseMap', () => {
      const { parseMap } = useCborCollection()

      // 0x80 = empty array, not a map
      expect(() => parseMap('80')).toThrow('Expected major type 5 (map)')
    })

    it('should throw error for truncated array data', () => {
      const { parseArray } = useCborCollection()

      // 0x83 = array(3), but only 2 elements provided
      expect(() => parseArray('830102')).toThrow()
    })

    it('should throw error for truncated map data', () => {
      const { parseMap } = useCborCollection()

      // 0xa2 = map(2 pairs), but only 1 pair provided
      expect(() => parseMap('a2616101')).toThrow()
    })
  })
})
