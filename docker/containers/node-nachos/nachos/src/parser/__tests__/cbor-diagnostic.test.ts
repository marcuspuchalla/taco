import { describe, it, expect } from 'vitest'
import { useCborDiagnostic } from '../composables/useCborDiagnostic'

describe('useCborDiagnostic', () => {
  const { toDiagnostic, fromDiagnostic } = useCborDiagnostic()

  describe('primitive values', () => {
    it('should format integers', () => {
      expect(toDiagnostic(0)).toBe('0')
      expect(toDiagnostic(1)).toBe('1')
      expect(toDiagnostic(23)).toBe('23')
      expect(toDiagnostic(100)).toBe('100')
      expect(toDiagnostic(1000000)).toBe('1000000')
      expect(toDiagnostic(-1)).toBe('-1')
      expect(toDiagnostic(-100)).toBe('-100')
    })

    it('should format BigInt', () => {
      expect(toDiagnostic(BigInt(100))).toBe('100')
      expect(toDiagnostic(BigInt('18446744073709551615'))).toBe('18446744073709551615')
      expect(toDiagnostic(BigInt(-100))).toBe('-100')
    })

    it('should format floats', () => {
      expect(toDiagnostic(1.5)).toBe('1.5')
      expect(toDiagnostic(100000.0)).toBe('100000')
      expect(toDiagnostic(3.14159)).toBe('3.14159')
    })

    it('should format special float values', () => {
      expect(toDiagnostic(NaN)).toBe('NaN')
      expect(toDiagnostic(Infinity)).toBe('Infinity')
      expect(toDiagnostic(-Infinity)).toBe('-Infinity')
      expect(toDiagnostic(-0)).toBe('-0.0')
    })

    it('should format booleans', () => {
      expect(toDiagnostic(true)).toBe('true')
      expect(toDiagnostic(false)).toBe('false')
    })

    it('should format null and undefined', () => {
      expect(toDiagnostic(null)).toBe('null')
      expect(toDiagnostic(undefined)).toBe('undefined')
    })
  })

  describe('strings', () => {
    it('should format simple strings', () => {
      expect(toDiagnostic('')).toBe('""')
      expect(toDiagnostic('a')).toBe('"a"')
      expect(toDiagnostic('IETF')).toBe('"IETF"')
      expect(toDiagnostic('hello world')).toBe('"hello world"')
    })

    it('should escape special characters', () => {
      expect(toDiagnostic('line1\nline2')).toBe('"line1\\nline2"')
      expect(toDiagnostic('tab\there')).toBe('"tab\\there"')
      expect(toDiagnostic('quote"here')).toBe('"quote\\"here"')
      expect(toDiagnostic('back\\slash')).toBe('"back\\\\slash"')
    })

    it('should escape control characters', () => {
      expect(toDiagnostic('\x00')).toBe('"\\u0000"')
      expect(toDiagnostic('\x1f')).toBe('"\\u001f"')
    })
  })

  describe('byte strings', () => {
    it('should format empty byte string', () => {
      expect(toDiagnostic(new Uint8Array([]))).toBe("h''")
    })

    it('should format byte strings', () => {
      expect(toDiagnostic(new Uint8Array([1, 2, 3, 4]))).toBe("h'01020304'")
      expect(toDiagnostic(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))).toBe("h'deadbeef'")
    })

    it('should format single byte', () => {
      expect(toDiagnostic(new Uint8Array([0xff]))).toBe("h'ff'")
      expect(toDiagnostic(new Uint8Array([0x00]))).toBe("h'00'")
    })
  })

  describe('arrays', () => {
    it('should format empty array', () => {
      expect(toDiagnostic([])).toBe('[]')
    })

    it('should format simple arrays', () => {
      expect(toDiagnostic([1, 2, 3])).toBe('[1, 2, 3]')
      expect(toDiagnostic(['a', 'b'])).toBe('["a", "b"]')
    })

    it('should format nested arrays', () => {
      expect(toDiagnostic([1, [2, 3]])).toBe('[1, [2, 3]]')
      expect(toDiagnostic([[1, 2], [3, 4]])).toBe('[[1, 2], [3, 4]]')
    })

    it('should format indefinite arrays', () => {
      expect(toDiagnostic([1, 2, 3], { indefinite: true })).toBe('[_ 1, 2, 3]')
      expect(toDiagnostic([], { indefinite: true })).toBe('[_ ]')
    })

    it('should format mixed type arrays', () => {
      expect(toDiagnostic([1, 'hello', true, null])).toBe('[1, "hello", true, null]')
    })
  })

  describe('maps and objects', () => {
    it('should format empty objects', () => {
      expect(toDiagnostic({})).toBe('{}')
    })

    it('should format simple objects', () => {
      expect(toDiagnostic({ a: 1 })).toBe('{"a": 1}')
      expect(toDiagnostic({ a: 1, b: 2 })).toBe('{"a": 1, "b": 2}')
    })

    it('should format nested objects', () => {
      expect(toDiagnostic({ a: { b: 1 } })).toBe('{"a": {"b": 1}}')
    })

    it('should format indefinite maps', () => {
      expect(toDiagnostic({ a: 1 }, { indefinite: true })).toBe('{_ "a": 1}')
    })

    it('should format Maps with non-string keys', () => {
      const map = new Map<any, any>([[1, 'one'], [2, 'two']])
      expect(toDiagnostic(map)).toBe('{1: "one", 2: "two"}')
    })

    it('should format empty Maps', () => {
      expect(toDiagnostic(new Map())).toBe('{}')
    })
  })

  describe('tagged values', () => {
    it('should format simple tags', () => {
      expect(toDiagnostic({ tag: 0, value: '2024-01-01T00:00:00Z' }))
        .toBe('0("2024-01-01T00:00:00Z")')
    })

    it('should format epoch timestamp tag', () => {
      expect(toDiagnostic({ tag: 1, value: 1363896240 }))
        .toBe('1(1363896240)')
    })

    it('should format bignum tags', () => {
      expect(toDiagnostic({ tag: 2, value: new Uint8Array([1, 0, 0, 0, 0, 0, 0, 0, 0]) }))
        .toBe("2(h'010000000000000000')")
    })

    it('should format self-describe CBOR tag', () => {
      expect(toDiagnostic({ tag: 55799, value: [1, 2] }))
        .toBe('55799([1, 2])')
    })

    it('should format Plutus constructor tags', () => {
      expect(toDiagnostic({ tag: 121, value: [1, 2] }))
        .toBe('121([1, 2])')
      expect(toDiagnostic({ tag: 122, value: [] }))
        .toBe('122([])')
    })

    it('should format nested tags', () => {
      expect(toDiagnostic({ tag: 1, value: { tag: 0, value: 'test' } }))
        .toBe('1(0("test"))')
    })
  })

  describe('pretty printing', () => {
    it('should pretty print arrays', () => {
      const result = toDiagnostic([1, 2, 3], { pretty: true })
      expect(result).toBe('[\n  1,\n  2,\n  3\n]')
    })

    it('should pretty print objects', () => {
      const result = toDiagnostic({ a: 1, b: 2 }, { pretty: true })
      expect(result).toBe('{\n  "a": 1,\n  "b": 2\n}')
    })

    it('should pretty print nested structures', () => {
      const result = toDiagnostic({ arr: [1, 2] }, { pretty: true })
      expect(result).toContain('{\n')
      expect(result).toContain('"arr":')
      expect(result).toContain('[')
    })

    it('should use custom indent', () => {
      const result = toDiagnostic([1, 2], { pretty: true, indent: '    ' })
      expect(result).toBe('[\n    1,\n    2\n]')
    })
  })

  describe('fromDiagnostic (basic parsing)', () => {
    it('should parse null and undefined', () => {
      expect(fromDiagnostic('null')).toBe(null)
      expect(fromDiagnostic('undefined')).toBe(undefined)
    })

    it('should parse booleans', () => {
      expect(fromDiagnostic('true')).toBe(true)
      expect(fromDiagnostic('false')).toBe(false)
    })

    it('should parse special floats', () => {
      expect(fromDiagnostic('NaN')).toBeNaN()
      expect(fromDiagnostic('Infinity')).toBe(Infinity)
      expect(fromDiagnostic('-Infinity')).toBe(-Infinity)
    })

    it('should parse numbers', () => {
      expect(fromDiagnostic('100')).toBe(100)
      expect(fromDiagnostic('-50')).toBe(-50)
      expect(fromDiagnostic('3.14')).toBe(3.14)
    })

    it('should parse byte strings', () => {
      const result = fromDiagnostic("h'0102'")
      expect(result).toBeInstanceOf(Uint8Array)
      expect(Array.from(result as Uint8Array)).toEqual([1, 2])
    })

    it('should parse empty byte string', () => {
      const result = fromDiagnostic("h''")
      expect(result).toBeInstanceOf(Uint8Array)
      expect((result as Uint8Array).length).toBe(0)
    })

    it('should parse strings', () => {
      expect(fromDiagnostic('"hello"')).toBe('hello')
      expect(fromDiagnostic('""')).toBe('')
    })
  })

  describe('RFC 8949 Appendix A examples', () => {
    // Examples from RFC 8949 Appendix A

    it('should format RFC examples - integers', () => {
      expect(toDiagnostic(0)).toBe('0')
      expect(toDiagnostic(23)).toBe('23')
      expect(toDiagnostic(24)).toBe('24')
      expect(toDiagnostic(100)).toBe('100')
      expect(toDiagnostic(1000)).toBe('1000')
      expect(toDiagnostic(1000000)).toBe('1000000')
    })

    it('should format RFC examples - negative integers', () => {
      expect(toDiagnostic(-1)).toBe('-1')
      expect(toDiagnostic(-10)).toBe('-10')
      expect(toDiagnostic(-100)).toBe('-100')
      expect(toDiagnostic(-1000)).toBe('-1000')
    })

    it('should format RFC examples - floats', () => {
      expect(toDiagnostic(0.0)).toBe('0')
      expect(toDiagnostic(1.0)).toBe('1')
      expect(toDiagnostic(1.5)).toBe('1.5')
    })

    it('should format RFC examples - strings', () => {
      expect(toDiagnostic('')).toBe('""')
      expect(toDiagnostic('a')).toBe('"a"')
      expect(toDiagnostic('IETF')).toBe('"IETF"')
    })

    it('should format RFC examples - arrays', () => {
      expect(toDiagnostic([])).toBe('[]')
      expect(toDiagnostic([1, 2, 3])).toBe('[1, 2, 3]')
      expect(toDiagnostic([1, [2, 3], [4, 5]])).toBe('[1, [2, 3], [4, 5]]')
    })

    it('should format RFC examples - maps', () => {
      expect(toDiagnostic({})).toBe('{}')
      expect(toDiagnostic({ a: 1, b: [2, 3] })).toBe('{"a": 1, "b": [2, 3]}')
    })
  })

  describe('Cardano-specific examples', () => {
    it('should format UTXO structure', () => {
      const utxo = [
        [
          new Uint8Array([0x48, 0xbd, 0x01, 0xd5]), // txHash (truncated)
          0 // index
        ]
      ]
      const result = toDiagnostic(utxo)
      expect(result).toBe("[[h'48bd01d5', 0]]")
    })

    it('should format Plutus constructor', () => {
      const constructor = { tag: 121, value: [1, 2] }
      expect(toDiagnostic(constructor)).toBe('121([1, 2])')
    })

    it('should format transaction metadata map', () => {
      const metadata = new Map([
        [674, { msg: ['Hello', 'World'] }]
      ])
      const result = toDiagnostic(metadata)
      expect(result).toContain('674:')
      expect(result).toContain('"msg"')
    })
  })

  describe('edge cases', () => {
    it('should handle depth limit', () => {
      const deepNested = { a: { b: { c: { d: 1 } } } }
      const result = toDiagnostic(deepNested, { maxDepth: 2 })
      expect(result).toContain('...')
    })

    it('should handle Sets', () => {
      const set = new Set([1, 2, 3])
      expect(toDiagnostic(set)).toBe('[1, 2, 3]')
    })

    it('should handle mixed content arrays', () => {
      const mixed = [
        1,
        'text',
        new Uint8Array([0xff]),
        { key: 'value' },
        [1, 2],
        true,
        null
      ]
      const result = toDiagnostic(mixed)
      expect(result).toBe('[1, "text", h\'ff\', {"key": "value"}, [1, 2], true, null]')
    })
  })
})
