vde.Vis.Pipeline = (function() {
  var pipeline = function(source) {
    this.name = 'pipeline_' + vg.keys(vde.Vis.pipelines).length;
    this.displayName = 'Data Pipeline ' + vde.Vis.codename(vg.keys(vde.Vis.pipelines).length);

    this.source = source;
    this.transforms = [];
    this._aggregate  = {};

    this.forkName = null;
    this.forkIdx  = null;

    this.scales = {};

    vde.Vis.pipelines[this.name] = this;

    return this;
  };

  var prototype = pipeline.prototype;

  prototype.spec = function() {
    var self = this;
    var specs = [{
      name: this.name,
      source: this.source,
      transform: []
    }];

    vde.Vis.callback.run('pipeline.pre_spec', this, {spec: specs});

    var spec = 0;
    this.transforms.forEach(function(t, i) {
      // If we've forked and the current transform can't deal with
      // faceted data, don't add it to the regular pipeline but let
      // group injection deal with it
      if(spec > 0 && !t.onFork()) return;

      if(t.forkPipeline) {
        spec++;
        self.forkName || (self.forkName = self.name + '_' + t.type);
        self.forkIdx = i;

        specs.push({
          name: self.forkName,
          source: self.source,
          transform: vg.duplicate(specs[spec-1].transform || [])
        });
      }

      var s = t.spec();
      if(s) specs[spec].transform.push(s);
    });

    vde.Vis.callback.run('pipeline.post_spec', this, {spec: specs});

    return specs;
  };

  prototype.bookkeep = function() {
    for(var s in this.scales)
      if(!this.scales[s].used && !this.scales[s].manual) delete this.scales[s];
  };

  prototype.aggregate = function(field, stat) {
    field.stat = null;  // Erase the current state so that we get a common fieldSpec
    var fieldSpec = field.spec(), median = (stat == 'median');
    if(!this._aggregate[fieldSpec]) {
      var stats = new vde.Vis.transforms.Stats(this.name);
      stats.properties.value = fieldSpec;
      stats.properties.median = median;
      this.addTransform(stats);
      this._aggregate[fieldSpec] = stats;
    } else if(median) {
      this._aggregate[fieldSpec].properties.median = true;
    }

    field.stat = stat;
  };

  prototype.values = function(sliceBeg, sliceEnd) {
    var values = vg.duplicate(vde.Vis._data[this.source].values).map(vg.data.ingest);
    this.transforms.slice(sliceBeg, sliceEnd).forEach(function(t) {
      if(t.isVisual) return;

      values = t.transform(values);
    });

    return values;
  };

  prototype.schema = function(sliceBeg, sliceEnd) {
    var self = this,
        fields = [], seenFields = {};
    var values = vg.duplicate(vde.Vis._data[this.source].values).map(vg.data.ingest);

    var buildFields = function(data, pipeline, depth) {
      var parse = vde.Vis._data[self.source].format.parse || {};

      if(data.values) {
        if(!seenFields.key) {
          fields.push(new vde.Vis.Field('key', '', 'ordinal', pipeline));
          seenFields.key = true;
        }

        buildFields(data.values, pipeline, ++depth);
      }
      else {
        [data[0].data, data[0]].forEach(function(v, i) {
          vg.keys(v).forEach(function(k) {
            if(i != 0 && ['data', 'values', 'keys', 'stats'].indexOf(k) != -1) return;
            if(k == 'key') k += '_' + depth;
            if(seenFields[k]) return;

            var field = new vde.Vis.Field(k, (i == 0) ? 'data.' : '');
            field.pipelineName = pipeline;
            if(parse[k]) field.type = (parse[k] == 'date') ? 'time' : (parse[k] == 'number') ? 'linear' : 'ordinal';
            else field.type = vg.isNumber(v[k]) ? 'linear' : 'ordinal';

            fields.push(field);
            seenFields[k] = true;
          });
        });
      }
    };

    // Build fields once before we apply any transforms
    buildFields(values, this.name, 0);

    var pipelineName = this.name;
    this.transforms.slice(sliceBeg, sliceEnd).forEach(function(t) {
      if(t.forkPipeline) pipelineName = self.forkName;
      if(t.isVisual) return;

      if(t.type == 'stats') {
        t.spec(); // Build spec to populate fields.
        t.fields.forEach(function(f) { seenFields[f] = true; });
      }

      // If this transform can't deal with faceted values
      if(!t.onFork() && pipelineName != self.name) {

      } else {
        values = t.transform(values);
        buildFields(values, pipelineName, 0);
      }

    });

    return [fields, values];
  };

  // Given a definition, find a pre-existing scale that matches,
  // or if none do, build a new scale.
  prototype.scale = function(searchDef, defaultDef, displayName) {
    for(var scaleName in this.scales) {
      if(this.scales[scaleName].equals(searchDef))
        return this.scales[scaleName];
    }

    for(var k in defaultDef)
      searchDef[k] = defaultDef[k];

    return new vde.Vis.Scale('', this, searchDef, displayName);
  };

  // Figure out where to add the transform:
  // If the transform requires a fork, add it to the end
  // otherwise, assume look at properties to see where to
  // add it
  prototype.addTransform = function(t) {
    t.pipelineName = this.name;
    if(!this.forkName || t.forkPipeline || t.requiresFork) return this.transforms.push(t);
    else {
      var self = this, pipelineName = this.name;
      var checkField = function(f) {
        pipelineName = f.pipelineName;
        if(pipelineName == self.forkName || f.stat) {
          pipelineName = self.forkName;
          return true;
        }
        return false;
      }
      vg.keys(t.properties).some(function(k) {
        var f = t.properties[k];
        if(f instanceof vde.Vis.Field) return checkField(f);
      });

      if(t.exprFields) t.exprFields.some(function(f) { return checkField(f); });

      if(pipelineName == this.forkName) return this.transforms.push(t);
      else { this.transforms.splice(this.forkIdx, 0, t); return this.forkIdx;}
    }
  };

  return pipeline;
})();
