import krpc

def get_connection(name):
    return krpc.connect(name=name)