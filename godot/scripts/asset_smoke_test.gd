extends SceneTree

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var checks := [
		{"path": "res://assets/characters/guard_dog_walker.glb", "label": "Dog Walker guard"},
		{"path": "res://assets/characters/prisoner_casual_walker.glb", "label": "Casual Walker prisoner"},
	]
	for check in checks:
		var packed := load(str(check.path)) as PackedScene
		if packed == null:
			push_error("Could not load character model: %s" % str(check.path))
			quit(1)
			return
		var instance := packed.instantiate()
		var holder := Node3D.new()
		root.add_child(holder)
		holder.add_child(instance)
		await process_frame
		var skeleton := _find_skeleton(instance)
		if skeleton == null:
			push_error("%s model has no Skeleton3D rig." % str(check.label))
			holder.free()
			quit(1)
			return
		var bone_names: Array[String] = []
		for index in range(skeleton.get_bone_count()):
			bone_names.append(skeleton.get_bone_name(index))
		var player := _find_animation_player(instance)
		var clip_names := player.get_animation_list() if player else PackedStringArray()
		var lowered_clips := PackedStringArray()
		for clip in clip_names:
			lowered_clips.append(clip.to_lower())
		if skeleton.get_bone_count() < 50:
			push_error("%s model has an incomplete humanoid rig (%s bones)." % [str(check.label), str(skeleton.get_bone_count())])
			holder.free()
			quit(1)
			return
		for required_clip in ["idle", "walk"]:
			var found := false
			for clip in lowered_clips:
				if clip.contains(required_clip):
					found = true
					break
			if not found:
				push_error("%s model is missing required %s animation. Found: %s" % [str(check.label), required_clip, ", ".join(clip_names)])
				holder.free()
				quit(1)
				return
		var bounds := _world_bounds(instance)
		print("%s: Skeleton3D OK (%s bones): %s" % [str(check.label), str(skeleton.get_bone_count()), ", ".join(bone_names)])
		print("%s: imported animations OK: %s" % [str(check.label), ", ".join(clip_names)])
		print("%s: imported model bounds = %s" % [str(check.label), str(bounds.size)])
		holder.free()
	quit(0)

func _world_bounds(node: Node) -> AABB:
	var result := AABB()
	var has_point := false
	var mesh_nodes: Array[MeshInstance3D] = []
	_collect_mesh_nodes(node, mesh_nodes)
	for mesh_node in mesh_nodes:
		var aabb := mesh_node.get_aabb()
		var transform := mesh_node.global_transform
		for x in [aabb.position.x, aabb.end.x]:
			for y in [aabb.position.y, aabb.end.y]:
				for z in [aabb.position.z, aabb.end.z]:
					var point := transform * Vector3(x, y, z)
					if not has_point:
						result = AABB(point, Vector3.ZERO)
						has_point = true
					else:
						result = result.expand(point)
	return result

func _collect_mesh_nodes(node: Node, result: Array[MeshInstance3D]) -> void:
	if node is MeshInstance3D:
		result.append(node as MeshInstance3D)
	for child in node.get_children():
		_collect_mesh_nodes(child, result)

func _find_skeleton(node: Node) -> Skeleton3D:
	if node is Skeleton3D:
		return node as Skeleton3D
	for child in node.get_children():
		var found := _find_skeleton(child)
		if found:
			return found
	return null

func _find_animation_player(node: Node) -> AnimationPlayer:
	if node is AnimationPlayer:
		return node as AnimationPlayer
	for child in node.get_children():
		var found := _find_animation_player(child)
		if found:
			return found
	return null
