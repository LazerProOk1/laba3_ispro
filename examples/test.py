def area(a, b, c):
    s = (a + b + c) / 2
    return (s * (s - a) * (s - b) * (s - c)) ** 0.5


class Shape:
    def scale(self, data: dict[str, int], k: int = 2, *args, **kwargs) -> list[int]:
        if k < 0:
            raise ValueError("bad k")
        return [1]


def long_one(
    a: int,
    b: str = "x, y",
) -> None:
    print(a)


def documented(x):
    '''Уже есть описание.'''
    return x