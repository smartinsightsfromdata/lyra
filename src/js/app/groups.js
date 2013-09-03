vde.App.controller('GroupsCtrl', function($scope, $rootScope, $timeout, logger) {
  $scope.gMdl = { // General catch-all model for scoping
    groups: vde.Vis.groups,
    groupOrder: vde.Vis.groupOrder,
    pipelines: vde.Vis.pipelines,
    sortableOpts: {
      update: function(e, ui) { $timeout(function() { vde.Vis.parse(); }, 1); },
      axis: 'y'
    }
  };

  $rootScope.toggleVisual = function(v, key) {
    $rootScope.activeVisual = v;
    $rootScope.activeGroup  = v.group() || v;

    $rootScope.activePipeline = v.pipelineName ? v.pipeline() : $rootScope.activePipeline;
    $scope.gMdl.activeVisualPipeline = (v.pipeline() || {}).name;

    if(vde.iVis.activeMark != v || key != null) {
      vde.iVis.activeMark = v;
      vde.iVis.activeItem = key || 0;
      vde.iVis.show('selected');
    }

    logger.log('toggle_visual', {
      activeVisual: v.name,
      activeGroup: v.groupName || v.name,
      visualPipeline: v.pipelineName,
      activePipeline: ($rootScope.activePipeline||{}).name
    });
  };

  $scope.setPipeline = function() {
    var p = $scope.gMdl.activeVisualPipeline;
    if(p == '') $scope.activeVisual.pipelineName = null;
    else if(p == 'vdeNewPipeline') {
      var pipeline = new vde.Vis.Pipeline();
      $scope.activeVisual.pipelineName = pipeline.name
      $rootScope.activePipeline = pipeline;
      $scope.gMdl.activeVisualPipeline = pipeline.name;
    }
    else {
      $scope.activeVisual.pipelineName = p;
      $rootScope.activePipeline = vde.Vis.pipelines[p];
    }

    vde.Vis.parse();

    logger.log('set_pipeline', {
      activeVisual: $rootScope.activeVisual.name,
      activeGroup: $rootScope.activeGroup.name,
      activeVisualPipeline: p,
      activePipeline: $rootScope.activePipeline.name
    }, true, true);
  };

  $scope.addGroup = function() {
    var g = new vde.Vis.marks.Group();
    $rootScope.activeGroup = g;
    $rootScope.activeVisual = g;

    logger.log('new_group', {
      activeVisual: g.name,
      activeGroup: g.groupName || g.name,
      visualPipeline: g.pipelineName,
      activePipeline: $rootScope.activePipeline.name
    }, true);
  };

  $scope.addAxis = function() {
    var axis = new vde.Vis.Axis('', $rootScope.activeGroup.name);
    $rootScope.activeVisual = axis;

    logger.log('new_axis', {
      activeVisual: axis.name,
      activeGroup: axis.groupName || axis.name,
      visualPipeline: axis.pipelineName,
      activePipeline: $rootScope.activePipeline.name
    }, true);
  };

  $rootScope.removeVisual = function(type, name) {
    var cnf = confirm("Are you sure you wish to delete this visual element?")
    if(!cnf) return;

    if(type == 'group') delete vde.Vis.groups[name];
    else delete $rootScope.activeGroup[type][name];
    vde.Vis.parse();

    $('.tooltip').remove();

    logger.log('remove_visual', {
      type: type,
      name: name,
      activeGroup: $rootScope.activeGroup.name,
      activePipeline: $rootScope.activePipeline.name
    }, true);
  };

  $scope.newTransform = function(type) {
    var t = new vde.Vis.transforms[type]($rootScope.activeVisual.pipelineName);
    $rootScope.activeVisual.pipeline().transforms.push(t);
  };

  $scope.removeTransform = function(i) {
    var cnf = confirm("Are you sure you wish to delete this transformation?")
    if(!cnf) return;

    $rootScope.activeVisual.pipeline().transforms[i].destroy();
    $rootScope.activeVisual.pipeline().transforms.splice(i, 1);
    vde.Vis.parse();

    $('.tooltip').remove();

    logger.log('remove_transform', { idx: i }, false, true);
  };

  $scope.toggleFont = function(prop, value) {
    var p = $rootScope.activeVisual.properties[prop];
    if(p.value == value) delete p.value;
    else p.value = value;

    $rootScope.activeVisual.checkExtents(prop);

    $rootScope.activeVisual.update(prop);
  };

  $scope.editVisualization = function() {
    $rootScope.editVis = !$rootScope.editVis;
    $rootScope.vis = vde.Vis.properties;

    logger.log('edit_vis', {});
  };
});
