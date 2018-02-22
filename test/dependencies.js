'use strict'

const chai = require('chai')
const dependencies = require('../src/dependencies')

describe('dependencies', () => {
  describe('getGTKDepends', () => {
    it('returns GTK2 pre-2.0', () => {
      chai.expect(dependencies.getGTKDepends('1.8.2')).to.equal('libgtk2.0-0')
    })

    it('returns GTK3 as of 2.0', () => {
      chai.expect(dependencies.getGTKDepends('2.0.0')).to.equal('libgtk-3-0')
    })
  })

  describe('getTrashDepends', () => {
    it('only depends on gvfs-bin before 1.4.1', () => {
      const trashDepends = dependencies.getTrashDepends('1.3.0')
      chai.expect(trashDepends).to.match(/gvfs-bin/)
      chai.expect(trashDepends).to.not.match(/kde-cli-tools/)
      chai.expect(trashDepends).to.not.match(/libglib2\.0-bin/)
    })

    it('depends on KDE tools between 1.4.1 and 1.7.1', () => {
      const trashDepends = dependencies.getTrashDepends('1.6.0')
      chai.expect(trashDepends).to.match(/gvfs-bin/)
      chai.expect(trashDepends).to.match(/kde-cli-tools/)
      chai.expect(trashDepends).to.not.match(/libglib2\.0-bin/)
    })

    it('depends on glib starting with 1.7.2', () => {
      const trashDepends = dependencies.getTrashDepends('1.8.2')
      chai.expect(trashDepends).to.match(/gvfs-bin/)
      chai.expect(trashDepends).to.match(/kde-cli-tools/)
      chai.expect(trashDepends).to.match(/libglib2\.0-bin/)
    })
  })
})
