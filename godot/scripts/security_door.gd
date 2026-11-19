extends AnimatableBody3D

@export var open_angle_degrees: float = 92.0
@export var animation_seconds: float = 0.72
var is_open: bool = false
var _closed_yaw: float = 0.0
var _motion: Tween

func _ready() -> void:
	_closed_yaw = rotation.y

func toggle() -> void:
	set_open(not is_open)

func set_open(value: bool) -> void:
	is_open = value
	if _motion and _motion.is_running():
		_motion.kill()
	var destination := _closed_yaw
	if is_open:
		destination += deg_to_rad(open_angle_degrees)
	_motion = create_tween()
	_motion.set_trans(Tween.TRANS_SINE)
	_motion.set_ease(Tween.EASE_IN_OUT)
	_motion.tween_property(self, "rotation:y", destination, animation_seconds)
