extends SceneTree

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var checks := [
		{"path": "res://assets/characters/guard.glb", "label": "Ara high-detail warden"},
		{"path": "res://assets/characters/prisoner.glb", "label": "Ara high-detail prisoner"},
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
		if skeleton == null or skeleton.get_bone_count() < 60:
			push_error("%s model has no full Mixamo-compatible game rig (%s bones)." % [
				str(check.label),
				str(skeleton.get_bone_count()) if skeleton else "0"
			])
			holder.free()
			quit(1)
			return
		var animation_player := _find_animation_player(instance)
		if animation_player == null:
			push_error("%s model has no AnimationPlayer." % str(check.label))
			holder.free()
			quit(1)
			return
		var clip_names := animation_player.get_animation_list()
		var lowered_clips := PackedStringArray()
		for clip in clip_names:
			lowered_clips.append(clip.to_lower())
		for required_clip in ["idle", "walk", "run"]:
			var found := false
			for clip in lowered_clips:
				if clip.contains(required_clip):
					found = true
					break
			if not found:
				push_error("%s model is missing required %s animation. Found: %s" % [
					str(check.label), required_clip, ", ".join(clip_names)
				])
				holder.free()
				quit(1)
				return
		var mesh_stats := _mesh_stats(instance)
		if mesh_stats.triangles < 50000:
			push_error("%s model is not high-detail: %s triangles." % [str(check.label), str(mesh_stats.triangles)])
			holder.free()
			quit(1)
			return
		if mesh_stats.textured_surfaces < 1:
			push_error("%s model has no imported PBR/albedo texture surfaces." % str(check.label))
			holder.free()
			quit(1)
			return
		var bounds := _world_bounds(instance)
		if bounds.size.y < 1.45 or bounds.size.y > 2.2:
			push_error("%s model height is out of the expected human scale: %s" % [str(check.label), str(bounds.size.y)])
			holder.free()
			quit(1)
			return
		print("%s: %s bones · %s triangles · %s textured surfaces." % [
			str(check.label),
			str(skeleton.get_bone_count()),
			str(mesh_stats.triangles),
			str(mesh_stats.textured_surfaces)
		])
		print("%s: imported animation clips: %s" % [str(check.label), ", ".join(clip_names)])
		print("%s: imported model bounds = %s" % [str(check.label), str(bounds.size)])
		holder.free()
	quit(0)

func _mesh_stats(node: Node) -> Dictionary:
	var result := {"triangles": 0, "textured_surfaces": 0}
	var mesh_nodes: Array[MeshInstance3D] = []
	_collect_mesh_nodes(node, mesh_nodes)
	for mesh_node in mesh_nodes:
		var mesh := mesh_node.mesh
		if mesh == null:
			continue
		for surface in range(mesh.get_surface_count()):
			var arrays := mesh.surface_get_arrays(surface)
			var vertices: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
			var indices: PackedInt32Array = arrays[Mesh.ARRAY_INDEX]
			result.triangles += int(indices.size() / 3) if not indices.is_empty() else int(vertices.size() / 3)
			var material := mesh.surface_get_material(surface)
			if material is BaseMaterial3D and (material as BaseMaterial3D).albedo_texture != null:
				result.textured_surfaces += 1
	return result

func _world_bounds(node: Node) -> AABB:
	var result := AABB()
	var has_point := false
	var mesh_nodes: Array[MeshInstance3D] = []
	_collect_mesh_nodes(node, mesh_nodes)
	for mesh_node in mesh_nodes:
		var mesh := mesh_node.mesh
		if mesh == null:
			continue
		var aabb := mesh.get_aabb()
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
