import { describe, it, expect } from 'vitest'
import { PathBuilder } from '../utils/pathBuilder'

describe('PathBuilder', () => {
  describe('basic path creation', () => {
    it('should create root path', () => {
      expect(PathBuilder.root()).toBe('')
    })

    it('should create array index paths', () => {
      expect(PathBuilder.arrayIndex('', 0)).toBe('[0]')
      expect(PathBuilder.arrayIndex('', 1)).toBe('[1]')
      expect(PathBuilder.arrayIndex('[0]', 2)).toBe('[0][2]')
    })

    it('should create nested array paths', () => {
      const path1 = PathBuilder.arrayIndex('', 0)
      const path2 = PathBuilder.arrayIndex(path1, 1)
      const path3 = PathBuilder.arrayIndex(path2, 2)

      expect(path1).toBe('[0]')
      expect(path2).toBe('[0][1]')
      expect(path3).toBe('[0][1][2]')
    })

    it('should create map key paths', () => {
      expect(PathBuilder.mapKey('', 'amount')).toBe('.amount')
      expect(PathBuilder.mapKey('[0]', 'txHash')).toBe('[0].txHash')
      expect(PathBuilder.mapKey('[0].data', 'value')).toBe('[0].data.value')
    })

    it('should escape special characters in keys', () => {
      expect(PathBuilder.mapKey('', 'key.with.dots')).toBe('.key\\.with\\.dots')
      expect(PathBuilder.mapKey('', 'key[0]')).toBe('.key\\[0\\]')
      expect(PathBuilder.mapKey('', 'back\\slash')).toBe('.back\\\\slash')
    })

    it('should create map key index paths', () => {
      expect(PathBuilder.mapKeyIndex('', 0)).toBe('[#key:0]')
      expect(PathBuilder.mapKeyIndex('[0]', 1)).toBe('[0][#key:1]')
    })
  })

  describe('special markers', () => {
    it('should create header paths', () => {
      expect(PathBuilder.header('')).toBe('[#header]')
      expect(PathBuilder.header('[0]')).toBe('[0][#header]')
      expect(PathBuilder.header('[0].data')).toBe('[0].data[#header]')
    })

    it('should create content paths', () => {
      expect(PathBuilder.content('')).toBe('[#content]')
      expect(PathBuilder.content('[0]')).toBe('[0][#content]')
      expect(PathBuilder.content('[0][1]')).toBe('[0][1][#content]')
    })

    it('should create tag value paths', () => {
      expect(PathBuilder.tagValue('')).toBe('[#value]')
      expect(PathBuilder.tagValue('[0]')).toBe('[0][#value]')
    })

    it('should normalize paths by removing markers', () => {
      expect(PathBuilder.normalize('[0][#header]')).toBe('[0]')
      expect(PathBuilder.normalize('[0][#content]')).toBe('[0]')
      expect(PathBuilder.normalize('[0][#value]')).toBe('[0]')
      expect(PathBuilder.normalize('[0].data[#header]')).toBe('[0].data')
      expect(PathBuilder.normalize('[0]')).toBe('[0]') // no marker
    })

    it('should check for header paths', () => {
      expect(PathBuilder.isHeader('[0][#header]')).toBe(true)
      expect(PathBuilder.isHeader('[0][#content]')).toBe(false)
      expect(PathBuilder.isHeader('[0]')).toBe(false)
    })

    it('should check for content paths', () => {
      expect(PathBuilder.isContent('[0][#content]')).toBe(true)
      expect(PathBuilder.isContent('[0][#header]')).toBe(false)
      expect(PathBuilder.isContent('[0]')).toBe(false)
    })

    it('should check for tag value paths', () => {
      expect(PathBuilder.isTagValue('[0][#value]')).toBe(true)
      expect(PathBuilder.isTagValue('[0][#header]')).toBe(false)
      expect(PathBuilder.isTagValue('[0]')).toBe(false)
    })

    it('should check for any marker', () => {
      expect(PathBuilder.hasMarker('[0][#header]')).toBe(true)
      expect(PathBuilder.hasMarker('[0][#content]')).toBe(true)
      expect(PathBuilder.hasMarker('[0][#value]')).toBe(true)
      expect(PathBuilder.hasMarker('[0]')).toBe(false)
    })
  })

  describe('path traversal', () => {
    it('should get parent path', () => {
      expect(PathBuilder.getParent('[0]')).toBe('')
      expect(PathBuilder.getParent('[0][1]')).toBe('[0]')
      expect(PathBuilder.getParent('[0].data')).toBe('[0]')
      expect(PathBuilder.getParent('.field')).toBe('')
      expect(PathBuilder.getParent('')).toBe(null)
    })

    it('should get parent path from marker paths', () => {
      expect(PathBuilder.getParent('[0][#header]')).toBe('')
      expect(PathBuilder.getParent('[0][1][#content]')).toBe('[0]')
    })

    it('should calculate path depth', () => {
      expect(PathBuilder.getDepth('')).toBe(0)
      expect(PathBuilder.getDepth('[0]')).toBe(1)
      expect(PathBuilder.getDepth('[0][1]')).toBe(2)
      expect(PathBuilder.getDepth('[0].data')).toBe(2)
      expect(PathBuilder.getDepth('[0][1].field.nested')).toBe(4)
    })

    it('should calculate depth ignoring markers', () => {
      expect(PathBuilder.getDepth('[0][#header]')).toBe(1)
      expect(PathBuilder.getDepth('[0][1][#content]')).toBe(2)
    })
  })

  describe('path parsing and building', () => {
    it('should parse simple paths', () => {
      expect(PathBuilder.parse('[0]')).toEqual([
        { type: 'index', value: 0 }
      ])

      expect(PathBuilder.parse('.field')).toEqual([
        { type: 'key', value: 'field' }
      ])
    })

    it('should parse nested paths', () => {
      expect(PathBuilder.parse('[0][1]')).toEqual([
        { type: 'index', value: 0 },
        { type: 'index', value: 1 }
      ])

      expect(PathBuilder.parse('[0].data.value')).toEqual([
        { type: 'index', value: 0 },
        { type: 'key', value: 'data' },
        { type: 'key', value: 'value' }
      ])
    })

    it('should parse paths with markers', () => {
      expect(PathBuilder.parse('[0][#header]')).toEqual([
        { type: 'index', value: 0 },
        { type: 'marker', value: 'header' }
      ])

      expect(PathBuilder.parse('[0][1][#content]')).toEqual([
        { type: 'index', value: 0 },
        { type: 'index', value: 1 },
        { type: 'marker', value: 'content' }
      ])
    })

    it('should build paths from segments', () => {
      expect(PathBuilder.build([
        { type: 'index', value: 0 }
      ])).toBe('[0]')

      expect(PathBuilder.build([
        { type: 'index', value: 0 },
        { type: 'key', value: 'data' },
        { type: 'marker', value: 'header' }
      ])).toBe('[0].data[#header]')
    })

    it('should roundtrip parse and build', () => {
      const paths = [
        '[0]',
        '[0][1]',
        '.field',
        '[0].data',
        '[0][1].nested.value',
        '[0][#header]',
        '[0].data[#content]'
      ]

      for (const path of paths) {
        const segments = PathBuilder.parse(path)
        const rebuilt = PathBuilder.build(segments)
        expect(rebuilt).toBe(path)
      }
    })
  })

  describe('path utilities', () => {
    it('should join paths', () => {
      expect(PathBuilder.join('', '[0]')).toBe('[0]')
      expect(PathBuilder.join('[0]', '[1]')).toBe('[0][1]')
      expect(PathBuilder.join('[0]', '.data')).toBe('[0].data')
      expect(PathBuilder.join('', '', '[0]', '')).toBe('[0]')
    })

    it('should check descendant relationships', () => {
      expect(PathBuilder.isDescendantOf('[0][1]', '[0]')).toBe(true)
      expect(PathBuilder.isDescendantOf('[0].data', '[0]')).toBe(true)
      expect(PathBuilder.isDescendantOf('[0][1][2]', '[0]')).toBe(true)
      expect(PathBuilder.isDescendantOf('[1]', '[0]')).toBe(false)
      expect(PathBuilder.isDescendantOf('[0]', '[0]')).toBe(false) // same path
      expect(PathBuilder.isDescendantOf('[0]', '')).toBe(true) // root ancestor
    })

    it('should handle marker paths in descendant check', () => {
      expect(PathBuilder.isDescendantOf('[0][#header]', '')).toBe(true)
      expect(PathBuilder.isDescendantOf('[0][1][#content]', '[0]')).toBe(true)
    })
  })

  describe('real-world CBOR paths', () => {
    it('should handle Cardano UTXO paths', () => {
      // Typical UTXO: [[txHash, index], amount]
      const utxoPath = PathBuilder.arrayIndex('', 0)
      const txHashPath = PathBuilder.arrayIndex(utxoPath, 0)
      const indexPath = PathBuilder.arrayIndex(utxoPath, 1)

      expect(utxoPath).toBe('[0]')
      expect(txHashPath).toBe('[0][0]')
      expect(indexPath).toBe('[0][1]')

      // With header/content for byte string
      const txHashHeader = PathBuilder.header(txHashPath)
      const txHashContent = PathBuilder.content(txHashPath)

      expect(txHashHeader).toBe('[0][0][#header]')
      expect(txHashContent).toBe('[0][0][#content]')
      expect(PathBuilder.normalize(txHashHeader)).toBe('[0][0]')
      expect(PathBuilder.normalize(txHashContent)).toBe('[0][0]')
    })

    it('should handle map with string keys', () => {
      // {amount: 1000000, fee: 200000}
      const amountPath = PathBuilder.mapKey('', 'amount')
      const feePath = PathBuilder.mapKey('', 'fee')

      expect(amountPath).toBe('.amount')
      expect(feePath).toBe('.fee')
    })

    it('should handle nested Cardano transaction structure', () => {
      // tx.inputs[0].txHash
      const inputsPath = PathBuilder.mapKey('', 'inputs')
      const firstInputPath = PathBuilder.arrayIndex(inputsPath, 0)
      const txHashPath = PathBuilder.mapKey(firstInputPath, 'txHash')

      expect(inputsPath).toBe('.inputs')
      expect(firstInputPath).toBe('.inputs[0]')
      expect(txHashPath).toBe('.inputs[0].txHash')
    })
  })
})
