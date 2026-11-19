extends SceneTree

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var checks := [
		{"path": "res://assets/characters/guard_swat.glb", "label": "SWAT guard"},
		{"path": "res://assets/characters/prisoner_punk.glb", "label": "Punk prisoner"},
	]
	for check in checks:
		var packed := load(str(check.path)) as PackedScene
		if packed == null:
			push_error("Could not load character model: %s" % str(check.path))
			quit(1)
			return
		var instance := packed.instantiate()
		var skeleton := _find_skeleton(instance)
		if skeleton == null:
			push_error("%s model has no Skeleton3D rig." % str(check.label))
			instance.free()
			quit(1)
			return
		var bone_names: Array[String] = []
		for index in range(skeleton.get_bone_count()):
			bone_names.append(skeleton.get_bone_name(index))
		var player := _find_animation_player(instance)
		var clip_names := player.get_animation_list() if player else PackedStringArray()
		print("%s: Skeleton3D OK (%s bones): %s" % [str(check.label), str(skeleton.get_bone_count()), ", ".join(bone_names)])
		print("%s: imported AnimationPlayer clips: %s" % [str(check.label), ", ".join(clip_names) if not clip_names.is_empty() else "none; runtime procedural bone gait is used"])
		instance.free()
	quit(0)

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
