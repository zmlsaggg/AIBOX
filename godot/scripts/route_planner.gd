extends Node

const GRID_STEP: float = 0.5
const MIN_X: float = -11.5
const MIN_Z: float = -8.5
const GRID_WIDTH: int = 51
const GRID_HEIGHT: int = 35
const WALKER_RADIUS: float = 0.29
const WALKER_HEIGHT: float = 1.68
const APPROACH_RADIUS_CELLS: int = 4

var grid := AStarGrid2D.new()
var built: bool = false
var excluded_rids: Array[RID] = []
var collision_mask: int = 1

func rebuild(excluded: Array[RID] = []) -> void:
	excluded_rids = excluded.duplicate()
	grid.region = Rect2i(0, 0, GRID_WIDTH, GRID_HEIGHT)
	grid.cell_size = Vector2(GRID_STEP, GRID_STEP)
	grid.offset = Vector2(MIN_X, MIN_Z)
	grid.diagonal_mode = AStarGrid2D.DIAGONAL_MODE_ONLY_IF_NO_OBSTACLES
	grid.default_compute_heuristic = AStarGrid2D.HEURISTIC_OCTILE
	grid.default_estimate_heuristic = AStarGrid2D.HEURISTIC_OCTILE
	grid.update()

	var space_state := get_world_3d().direct_space_state
	var capsule := CapsuleShape3D.new()
	capsule.radius = WALKER_RADIUS
	capsule.height = WALKER_HEIGHT

	for row in range(GRID_HEIGHT):
		for column in range(GRID_WIDTH):
			var cell := Vector2i(column, row)
			var world := _cell_to_world(cell)
			var query := PhysicsShapeQueryParameters3D.new()
			query.shape = capsule
			query.transform = Transform3D(Basis.IDENTITY, Vector3(world.x, WALKER_HEIGHT * 0.5 + 0.04, world.y))
			query.collision_mask = collision_mask
			query.collide_with_bodies = true
			query.collide_with_areas = false
			query.exclude = excluded_rids
			var hits := space_state.intersect_shape(query, 1)
			if not hits.is_empty():
				grid.set_point_solid(cell, true)

	built = true

func find_route(start: Vector3, target: Vector3) -> Dictionary:
	if not built:
		return {"ok": false, "reason": "Navigation grid has not been built yet."}
	if target.x < MIN_X or target.x > MIN_X + (GRID_WIDTH - 1) * GRID_STEP:
		return {"ok": false, "reason": "Target lies outside the walkable grid."}
	if target.z < MIN_Z or target.z > MIN_Z + (GRID_HEIGHT - 1) * GRID_STEP:
		return {"ok": false, "reason": "Target lies outside the walkable grid."}

	var start_id := _world_to_cell(Vector2(start.x, start.z))
	var goal_id := _world_to_cell(Vector2(target.x, target.z))
	if not grid.region.has_point(start_id):
		return {"ok": false, "reason": "Current position is outside the prison navigation grid."}

	var nearest_start := _nearest_free_cell(start_id, 3)
	if nearest_start == Vector2i(-1, -1):
		return {"ok": false, "reason": "No free navigation cell near current position."}
	start_id = nearest_start

	var candidate_goals: Array[Vector2i] = []
	if grid.region.has_point(goal_id) and not grid.is_point_solid(goal_id):
		candidate_goals.append(goal_id)
	else:
		for radius in range(1, APPROACH_RADIUS_CELLS + 1):
			for dx in range(-radius, radius + 1):
				for dz in range(-radius, radius + 1):
					if maxi(absi(dx), absi(dz)) != radius:
						continue
					var candidate := goal_id + Vector2i(dx, dz)
					if not grid.region.has_point(candidate) or grid.is_point_solid(candidate):
						continue
					candidate_goals.append(candidate)

	var best_path := PackedVector2Array()
	var best_goal := Vector2i(-1, -1)
	var best_score := INF
	for candidate in candidate_goals:
		var path := grid.get_id_path(start_id, candidate)
		if path.is_empty():
			continue
		var endpoint := _cell_to_world(candidate)
		var target_distance := endpoint.distance_to(Vector2(target.x, target.z))
		var score := target_distance * 8.0 + float(path.size())
		if score < best_score:
			best_score = score
			best_goal = candidate
			best_path = path

	if best_path.is_empty():
		return {"ok": false, "reason": "No collision-free route connects the current area to that target. A wall, furniture or closed door blocks it."}

	var waypoints: Array[Vector3] = []
	for index in range(1, best_path.size()):
		var cell := Vector2i(roundi(best_path[index].x), roundi(best_path[index].y))
		var point := _cell_to_world(cell)
		waypoints.append(Vector3(point.x, start.y, point.y))

	var endpoint2d := _cell_to_world(best_goal)
	var endpoint := Vector3(endpoint2d.x, start.y, endpoint2d.y)
	if waypoints.is_empty():
		waypoints.append(endpoint)

	return {
		"ok": true,
		"points": waypoints,
		"approach": endpoint,
		"reaches_target": endpoint.distance_to(Vector3(target.x, start.y, target.z)) <= 0.75,
		"waypoint_count": waypoints.size(),
	}

func get_reachable_options(start: Vector3, targets: Array[Dictionary]) -> Dictionary:
	var reachable: Array[Dictionary] = []
	var blocked: Array[Dictionary] = []
	for target in targets:
		var point := Vector3(float(target.get("x", 0.0)), start.y, float(target.get("z", 0.0)))
		var route := find_route(start, point)
		if route.get("ok", false):
			var approach: Vector3 = route["approach"]
			reachable.append({
				"id": str(target.get("id", "target")),
				"kind": str(target.get("kind", "area")),
				"approach": {"x": approach.x, "z": approach.z},
				"reaches_target": bool(route["reaches_target"]),
				"distance": float(route["waypoint_count"]) * GRID_STEP,
				"waypoints": route["points"],
			})
		else:
			blocked.append({
				"id": str(target.get("id", "target")),
				"reason": str(route.get("reason", "No route")),
			})
	return {"reachable": reachable, "blocked": blocked}

func _nearest_free_cell(origin: Vector2i, max_radius: int) -> Vector2i:
	for radius in range(max_radius + 1):
		var options: Array[Vector2i] = []
		for dx in range(-radius, radius + 1):
			for dz in range(-radius, radius + 1):
				if maxi(absi(dx), absi(dz)) != radius:
					continue
				var candidate := origin + Vector2i(dx, dz)
				if grid.region.has_point(candidate) and not grid.is_point_solid(candidate):
					options.append(candidate)
		if not options.is_empty():
			options.sort_custom(func(a: Vector2i, b: Vector2i) -> bool:
				return a.distance_squared_to(origin) < b.distance_squared_to(origin)
			)
			return options[0]
	return Vector2i(-1, -1)

func _world_to_cell(point: Vector2) -> Vector2i:
	return Vector2i(roundi((point.x - MIN_X) / GRID_STEP), roundi((point.y - MIN_Z) / GRID_STEP))

func _cell_to_world(cell: Vector2i) -> Vector2:
	return Vector2(MIN_X + float(cell.x) * GRID_STEP, MIN_Z + float(cell.y) * GRID_STEP)
