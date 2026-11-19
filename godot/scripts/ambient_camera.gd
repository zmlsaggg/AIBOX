extends Node3D

@export var sweep_degrees: float = 9.0
@export var sweep_speed: float = 0.42
var _clock: float = 0.0
@onready var lens: MeshInstance3D = get_node_or_null("Lens")

func _process(delta: float) -> void:
	_clock += delta
	rotation.y = sin(_clock * sweep_speed) * deg_to_rad(sweep_degrees)
	if lens and lens.material_override is StandardMaterial3D:
		var material := lens.material_override as StandardMaterial3D
		material.emission_energy_multiplier = 0.8 + (sin(_clock * 1.8) + 1.0) * 0.15
