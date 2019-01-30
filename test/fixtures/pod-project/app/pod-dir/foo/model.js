import DS from 'ember-data';

export default DS.Model.extend({

  bar: DS.hasMany('bar'),

  someAttr: DS.attr('custom-transform')

});
