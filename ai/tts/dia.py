from dia.model import Dia


model = Dia.from_pretrained("nari-labs/Dia-1.6B", compute_dtype="float16")

text = "[S1] 안녕하세요. 오늘도 좋은 하루 보내세요."

output = model.generate(text, use_torch_compile=True, verbose=True)

model.save_audio("simple.mp3", output)